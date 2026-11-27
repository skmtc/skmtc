/**
 * Unified parse context for both OAS and GraphQL inputs.
 *
 * One class, two protocol-specific states behind a discriminated union.
 * Universal capabilities (issue collection, logger mirroring,
 * dependency-ref tracking) live at the top of the class and apply to
 * both protocols. Protocol-specific state (`oasDocument` vs
 * `schema`/`registry`) sits on `this.protocol`, narrowed by
 * `this.protocol.type`. The OAS-flavored logging surface
 * (`logIssue`/`logIssueNoKey`/`logSkippedFields`) accepts a
 * {@link StackTrail} for location; the GQL-flavored surface (`log`,
 * `logSkippedFields` with a pre-computed `location` string) accepts a
 * raw string. Both funnel into the shared {@link ParseContext.logIssueAt}.
 *
 * `removeErroredItems` is universal; the removal it runs dispatches on
 * `protocol.type` because the cleanup step is document-shaped.
 */

import type { OpenAPIV3 } from 'openapi-types'
import { buildSchema, type GraphQLSchema } from 'graphql'
import { toDocumentFieldsV3 } from '@/parse/v3-0/document/toDocumentFieldsV3.ts'
import { toDocumentFieldsV3 as toDocumentFieldsV31 } from '@/parse/v3-1/document/toDocumentFieldsV3.ts'
import { toDocumentFieldsV3 as toDocumentFieldsV32 } from '@/parse/v3-2/document/toDocumentFieldsV3.ts'
import { toOasDialect } from '@/parse/toOasDialect.ts'
import type { SystemSettings } from '@/types/Settings.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { parseGqlDocument } from '@/gql/document/parseGqlDocument.ts'
import type { Logger } from '@/types/Logger.ts'
export type { AttributionState } from '@/types/AttributionState.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'
import { toKeptRefs, type KeptRefs } from '@/parse/keptRefs.ts'
import { toApplyingBrokenParameter, toNameAndIn } from '@/parse/pathParameters.ts'
import type { SkmtcDocumentInput, SkmtcParsedDocument } from '@/types/SkmtcDocument.ts'
import type {
  GqlParseOptions,
  LogAtArgs,
  LogIssueArgs,
  LogIssueAtArgs,
  LogIssueNoKeyArgs,
  LogSkippedValuesArgs
} from '@/context/parseTypes.ts'
import type { ParseIssue } from '@/context/ParseIssue.ts'
import { toSerializedError } from '@/types/SerializedError.ts'
import { LogLineIssueArg } from '@/types/LogLine.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasRefData } from '@/oas/ref/ref-types.ts'
import type { OasIssueType } from '@/context/generateTypes.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'
import {
  toRawRefTarget,
  toRefParts,
  toRefPathBucket,
  toRefPathSegments,
  type RefParts
} from '@/helpers/refFns.ts'
import { Reach } from '@/parse/Reach.ts'
import { toRefKey } from '@/parse/toRefKey.ts'
import { toRefTargetV3 } from '@/parse/v3-0/ref/toRefTargetV3.ts'
import { toRefTargetV3 as toRefTargetV31 } from '@/parse/v3-1/ref/toRefTargetV3.ts'
import { toRefTargetV3 as toRefTargetV32 } from '@/parse/v3-2/ref/toRefTargetV3.ts'
import type { ToRefTargetArgs } from '@/parse/v3-1/ref/toRefTargetV3.ts'
import type { ComponentsEntry } from '@/oas/components/Components.ts'

// Re-exports kept here for backwards-compat with the previous flat
// surface. New parser helpers should `import type` from
// `./parseTypes.ts` (input/arg shapes) or `./ParseIssue.ts`
// (issue / protocol enums); the class itself stays here.
export type { ParseIssue, GqlIssueType } from '@/context/ParseIssue.ts'
export type {
  GqlParseOptions,
  LogAtArgs,
  LogIssueArgs,
  LogIssueAtArgs,
  LogIssueNoKeyArgs,
  LogSkippedValuesArgs,
  ParseContextType,
  ParseErrorInput,
  ParseIssueInput,
  ParseWarningInput
} from '@/context/parseTypes.ts'

type OasProtocolState = {
  type: 'oas'
  documentObject: OpenAPIV3.Document
  oasDocument: OasDocument
}

type GqlProtocolState = {
  type: 'gql'
  schema: GraphQLSchema
  registry: GqlRegistry
  /**
   * Empty-at-construction `GqlDocument` that refs resolve through.
   * Populated by `parse()` at the end of the walk via
   * `gqlDocument.fields = { registry, operations, rootTypes }`. See the
   * forward-declared-refs section on `OasDocument` for why this is the
   * shape.
   */
  gqlDocument: GqlDocument
  options: GqlParseOptions
}

type ProtocolState = OasProtocolState | GqlProtocolState

/** An error registered against a ref key, and the location it was logged at. */
type RefError = {
  error: unknown
  location: string | undefined
}

type LogDependencyIssueArgs = {
  /** Full trail of the removed consumer. */
  location: string
  /** The removed ref the consumer depends on. */
  refKey: string
  /** The error that started the removal. */
  rootCause: RefError
}

/** A place that refers to a ref key. */
type RefConsumer = {
  consumer: StackTrail
  /** The key of the ref target whose parse registered it; `undefined` for the document's own walk. */
  refTarget: string | undefined
}

/** An OAS ref and the place it is written, which `#checkRefs` resolves. */
type WrittenRef = RefConsumer & {
  ref: RefParts & {
    $ref: string
    refType: OasRefData['refType']
    resolveOnce(): unknown
    toLoop(): { $ref: string }[] | undefined
  }
}

/** The dialect's parser for the target of a ref that does not point at a component. */
type ToRefTarget = (args: ToRefTargetArgs) => ComponentsEntry | undefined

type RemoveHolderArgs = WrittenRef & {
  error: unknown
  type: 'DANGLING_REF' | 'REF_TYPE_MISMATCH'
  message: string
}

type ToDanglingAllOfMemberArgs = {
  /** Why the member names nothing: no schema has its name, or its `$ref`s loop. */
  error: DanglingRefError
  /** The schema that holds the `allOf`. */
  stackTrail: StackTrail
}

/** The issue logged when a ref target's parser throws. */
const toInvalidType = (refType: OasRefData['refType']): OasIssueType => {
  switch (refType) {
    case 'schema':
      return 'INVALID_SCHEMA'
    case 'requestBody':
      return 'INVALID_REQUEST_BODY'
    case 'parameter':
      return 'INVALID_PARAMETER'
    case 'response':
    case 'link':
      // A link has no type of its own: in the document's walk its response reports it.
      return 'INVALID_RESPONSE'
    case 'example':
      return 'INVALID_EXAMPLE'
    case 'header':
      return 'INVALID_HEADER'
    case 'securityScheme':
      return 'INVALID_SECURITY_SCHEME'
    default: {
      const _exhaustive: never = refType
      throw new Error(`Unhandled ref type: ${_exhaustive}`)
    }
  }
}

/** Two issues with the same level, type, location and message are the same issue. */
const toIssueIdentity = (issue: ParseIssue): string =>
  [issue.level, issue.type, issue.location, issue.message].join('\u0000')

/** The stored form of an issue: an error's `cause` as a `SerializedError`. */
const toParseIssue = (issue: LogIssueAtArgs): ParseIssue => {
  if (issue.level !== 'error') {
    return issue
  }

  const { protocol, location, message } = issue
  const cause = issue.cause === undefined ? {} : { cause: toSerializedError(issue.cause) }

  switch (protocol) {
    case 'oas':
      return { protocol, level: 'error', type: issue.type, location, message, ...cause }
    case 'gql':
      return { protocol, level: 'error', type: issue.type, location, message, ...cause }
    default: {
      const _exhaustive: never = protocol
      throw new Error(`Unhandled protocol type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

type ConstructorArgs = {
  input: SkmtcDocumentInput
  logger: Logger
  silent?: boolean
  /**
   * Protocol-specific parse options. Only the matching protocol's
   * entry is consulted; the rest are ignored. Today only GQL uses
   * this; adding more is additive.
   */
  options?: { gql?: GqlParseOptions }
  /** `skmtc.config.json#settings.parse`: how the OpenAPI parsers treat what they cannot read faithfully. */
  system?: SystemSettings
}

export class ParseContext {
  issues: ParseIssue[] = []
  logger: Logger
  silent: boolean
  protocol: ProtocolState
  /**
   * The StackTrail of the currently-traversed position. Set by
   * factories via {@link ParseContext.withStackTrail} just before
   * constructing the node so the `OasBase` base can snapshot it.
   * `undefined` outside an active `withStackTrail` scope.
   */
  currentStackTrail: StackTrail | undefined

  /**
   * How the OpenAPI parsers treat what they cannot read faithfully
   * (`skmtc.config.json#settings.parse`). Each setting left out is `strict`.
   */
  system: SystemSettings

  // Universal dependency-ref tracking. Populated by parsers as they
  // encounter references. OAS uses `$ref` strings as keys; GQL would
  // use type names. The maps don't care about the encoding.
  #refConsumers: Map<string, RefConsumer[]> = new Map()
  #refErrors: Map<string, RefError[]> = new Map()
  /** Each OAS ref and the place it is written, which `#checkRefs` resolves once the document is parsed. */
  #oasRefs: WrittenRef[] = []
  /** The key (`toRefKey`) of each ref target `#parseRefTargets` parsed. */
  #refTargets: Set<string> = new Set()
  /** The key of the ref target `#inRefTarget` runs for; `undefined` in the document's own walk. */
  #refTarget: string | undefined
  /** {@link keptRefs}, once a merge has asked for it. */
  #keptRefs: { value: KeptRefs | undefined } | undefined
  /** What identifies each issue logged so far (`toIssueIdentity`). */
  #issueIdentities: Set<string> = new Set()
  /**
   * Frames of the trail `parse()` was called with (`[traceId, spanId,
   * 'parse']` through `toArtifacts`). Every trail built during the walk
   * starts with them; `#toDocumentTrail` strips them.
   */
  #rootFrames: readonly string[] = []

  constructor({ input, logger, silent = true, options, system }: ConstructorArgs) {
    this.logger = logger
    this.silent = silent
    this.system = system ?? {}

    switch (input.type) {
      case 'oas': {
        this.protocol = {
          type: 'oas',
          documentObject: input.value,
          oasDocument: new OasDocument()
        }
        break
      }
      case 'gql': {
        const schema = typeof input.value === 'string' ? buildSchema(input.value) : input.value
        this.protocol = {
          type: 'gql',
          schema,
          registry: new GqlRegistry({ schemas: {} }),
          // Empty `GqlDocument` issued up front so any `OasRef`
          // constructed during the walk has a stable resolution target.
          // `parse()` populates `gqlDocument.fields` once the walk
          // produces operations / rootTypes.
          gqlDocument: new GqlDocument(),
          options: options?.gql ?? {}
        }
        break
      }
      default: {
        const _exhaustive: never = input
        throw new Error(`Unhandled document input type: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  /**
   * OAS-only accessor. Throws when called on a GQL-protocol context —
   * deliberate, because OAS parser code uses this and a misroute is a
   * real bug, not a recoverable situation.
   */
  get oasDocument(): OasDocument {
    if (this.protocol.type !== 'oas') {
      throw new Error('oasDocument accessed on non-OAS ParseContext')
    }
    return this.protocol.oasDocument
  }

  /** OAS-only accessor; symmetric reason to {@link oasDocument}. */
  get documentObject(): OpenAPIV3.Document {
    if (this.protocol.type !== 'oas') {
      throw new Error('documentObject accessed on non-OAS ParseContext')
    }
    return this.protocol.documentObject
  }

  /** The refs of the document that a merge keeps as refs (`parse.intersections`); `undefined` under `merge`. */
  get keptRefs(): KeptRefs | undefined {
    this.#keptRefs ??= {
      value: toKeptRefs({ documentObject: this.documentObject, setting: this.system.intersections })
    }

    return this.#keptRefs.value
  }

  /** GQL-only accessor; throws if called on an OAS context. */
  get schema(): GraphQLSchema {
    if (this.protocol.type !== 'gql') {
      throw new Error('schema accessed on non-GQL ParseContext')
    }
    return this.protocol.schema
  }

  /** GQL-only accessor; throws if called on an OAS context. */
  get registry(): GqlRegistry {
    if (this.protocol.type !== 'gql') {
      throw new Error('registry accessed on non-GQL ParseContext')
    }
    return this.protocol.registry
  }

  /**
   * GQL-only accessor returning the in-flight `GqlDocument` (empty
   * during parse, populated at the end). Parsers use this when
   * constructing `OasRef`s via `registry.createRef(refName, context)`
   * so the resulting refs point at the right document instance.
   */
  get gqlDocument(): GqlDocument {
    if (this.protocol.type !== 'gql') {
      throw new Error('gqlDocument accessed on non-GQL ParseContext')
    }
    return this.protocol.gqlDocument
  }

  /**
   * Convenience: returns the discriminated `SkmtcParsedDocument` for
   * the active protocol. Useful for parser code that needs to hand a
   * document to `OasRef` (or `registry.createRef`) without manually
   * constructing the wrapper.
   */
  get parsedDocument(): SkmtcParsedDocument {
    switch (this.protocol.type) {
      case 'oas':
        return { type: 'oas', value: this.protocol.oasDocument }
      case 'gql':
        return { type: 'gql', value: this.protocol.gqlDocument }
      default: {
        const _exhaustive: never = this.protocol
        throw new Error(`Unhandled protocol type: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  /**
   * Runs the protocol-appropriate parse step and returns the result
   * wrapped in {@link SkmtcParsedDocument}. Both protocols walk under
   * `stackTrail`, so issue locations start with its frames; pruning
   * removes those frames before it reads a trail as a document address.
   */
  parse(stackTrail: StackTrail): SkmtcParsedDocument {
    this.#rootFrames = stackTrail.stackTrail

    switch (this.protocol.type) {
      case 'oas': {
        const oasState = this.protocol
        // The ONE place the OpenAPI version is examined: pick the dialect's
        // parser tree. Everything downstream is version-specific code living
        // in its own tree (v3-0 / v3-1 / v3-2) and never re-checks the version.
        const dialect = toOasDialect(oasState.documentObject.openapi)
        switch (dialect) {
          case '3.0':
            oasState.oasDocument.fields = toDocumentFieldsV3({
              documentObject: oasState.documentObject,
              stackTrail,
              context: this
            })
            this.#parseRefTargets(toRefTargetV3)
            break
          case '3.1':
            oasState.oasDocument.fields = toDocumentFieldsV31({
              documentObject: oasState.documentObject,
              stackTrail,
              context: this
            })
            this.#parseRefTargets(toRefTargetV31)
            break
          case '3.2':
            oasState.oasDocument.fields = toDocumentFieldsV32({
              documentObject: oasState.documentObject,
              stackTrail,
              context: this
            })
            this.#parseRefTargets(toRefTargetV32)
            break
          default: {
            const _exhaustive: never = dialect
            throw new Error(`Unhandled OAS dialect: ${JSON.stringify(_exhaustive)}`)
          }
        }
        this.#checkRefs()
        this.removeErroredItems()
        return { type: 'oas', value: oasState.oasDocument }
      }
      case 'gql': {
        const gqlState = this.protocol
        const { fields } = parseGqlDocument({
          options: gqlState.options,
          context: this,
          stackTrail
        })
        // Populate the empty `GqlDocument` issued at construction time.
        // Refs constructed during the walk hold a reference to this same
        // instance and now resolve through its filled registry.
        gqlState.gqlDocument.fields = fields
        this.removeErroredItems()
        return { type: 'gql', value: gqlState.gqlDocument }
      }
      default: {
        const _exhaustive: never = this.protocol
        throw new Error(`Unhandled protocol type: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  /**
   * Removes every item that depends on a ref with a registered error.
   *
   * OAS: a component with an error is removed, even when the error is in
   * one of its properties. Each consumer of a removed component is removed
   * too. A consumer that is itself a component (its trail starts
   * `components:<bucket>:<name>`) has its own consumers removed next, at any
   * depth. GraphQL removes the consuming field, union member or operation,
   * which leaves no ref to follow.
   *
   * Each removed consumer yields one `INVALID_DEPENDENCY_REF` at its
   * location. The message names the ref it depends on and the error that
   * started the removal; that error is the `cause`.
   *
   * A `paths:P:M:…` consumer trail resolves to the whole operation, so an
   * operation is removed even when the ref is only in a response it does
   * not generate from.
   */
  removeErroredItems(): void {
    const pending = [...this.#refErrors].flatMap(([refKey, [rootCause]]) =>
      rootCause === undefined ? [] : [{ refKey, rootCause }]
    )
    pending.forEach(({ refKey }) => this.#removeComponent(refKey))

    // `pending` grows while it is walked: each removed component queues its own consumers.
    for (const { refKey, rootCause } of pending) {
      for (const { consumer, refTarget } of this.#refConsumers.get(refKey) ?? []) {
        // The ref is inside a ref target: the target is removed, and what refers to it next.
        if (refTarget !== undefined) {
          if (this.oasDocument.removeRefTarget(refTarget) !== undefined) {
            this.#inRefTarget(refTarget, () =>
              this.#logDependencyIssue({ location: consumer.toString(), refKey, rootCause })
            )
            pending.push({ refKey: refTarget, rootCause })
          }
          continue
        }

        const documentTrail = this.#toDocumentTrail(consumer)
        const removedLocations = this.#removeConsumer(consumer, documentTrail)

        removedLocations.forEach(location =>
          this.#logDependencyIssue({ location, refKey, rootCause })
        )

        // A removed consumer that is a component has consumers of its own.
        // `removeItem` finds a component only once, so each is queued once and a cycle ends.
        const removedRefKey =
          this.protocol.type === 'oas' && removedLocations.length > 0
            ? documentTrail.toStackRef()
            : undefined

        if (removedRefKey !== undefined) {
          pending.push({ refKey: removedRefKey, rootCause })
        }
      }
    }
  }

  /**
   * Removes the OAS component a `#/components/<bucket>/<name>` ref key names,
   * or the ref target `#parseRefTargets` kept under the key.
   */
  #removeComponent(refKey: string): void {
    if (this.protocol.type !== 'oas') {
      return
    }

    if (this.#refTargets.has(refKey)) {
      this.protocol.oasDocument.removeRefTarget(refKey)
      return
    }

    const match = /^#\/components\/([^/]+)\/(.+)$/.exec(refKey)

    if (match) {
      this.protocol.oasDocument.removeItem(new StackTrail(['components', match[1], match[2]]))
    }
  }

  /**
   * Parses the target of each ref that does not point at a component
   * (`#/components/schemas/Pet/properties/tag`, `#/paths/~1pets/get/parameters/0`),
   * once, at its own position, and keeps it on the document under its key,
   * so the ref resolves. A target holds refs of its own, which may point at
   * more targets: the list of written refs grows while it is walked, so those
   * are parsed too.
   *
   * A pointer that leads nowhere is left to `#checkRefs`, which reports it as
   * naming nothing. A target that fails to parse removes what holds a ref to
   * it, as a component that fails does.
   */
  #parseRefTargets(toRefTarget: ToRefTarget): void {
    if (this.protocol.type !== 'oas') {
      return
    }

    const { oasDocument, documentObject } = this.protocol

    for (const { ref } of this.#oasRefs) {
      const key = toRefKey(ref)

      // A ref to a component, of its own kind or not, is resolved in
      // `components`; `#checkRefs` reports one of the wrong kind.
      if (
        ref.refName === '' ||
        toRefPathBucket(ref.refPath) !== undefined ||
        this.#refTargets.has(key)
      ) {
        continue
      }

      const value = toRawRefTarget(documentObject, ref)

      if (!isPlainObject(value)) {
        continue
      }

      this.#refTargets.add(key)

      const parent = new StackTrail([...this.#rootFrames, ...toRefPathSegments(ref.refPath)])

      const target = this.#inRefTarget(key, () =>
        tryParseAt({
          stackTrail: parent,
          key: ref.refName,
          context: this,
          type: toInvalidType(ref.refType),
          parent: value,
          fn: () =>
            toRefTarget({
              refType: ref.refType,
              name: ref.refName,
              value,
              stackTrail: parent,
              context: this
            })
        })
      )

      if (target !== undefined) {
        oasDocument.setRefTarget(key, target)
      }
    }
  }

  /**
   * Runs `fn` for the ref target kept under `key`, or for the document's own
   * walk when `key` is `undefined`. While it runs, errors and refs are
   * registered for that target, and not for the component or operation its
   * position is in, and an issue that repeats one already logged is dropped:
   * the document's walk reads most targets too.
   */
  #inRefTarget<T>(key: string | undefined, fn: () => T): T {
    const previous = this.#refTarget
    this.#refTarget = key
    try {
      return fn()
    } finally {
      this.#refTarget = previous
    }
  }

  /** Keeps an issue, and says whether it was new (see {@link #inRefTarget}). */
  #addIssue(issue: ParseIssue): boolean {
    const identity = toIssueIdentity(issue)

    if (this.#refTarget !== undefined && this.#issueIdentities.has(identity)) {
      return false
    }

    this.#issueIdentities.add(identity)
    this.issues.push(issue)

    return true
  }

  /**
   * Removes the item `consumer` sits in and returns the location of each
   * removed item: `consumer` itself, or for a path-level parameter
   * (`paths:<path>:parameters:<index>:…`, `webhooks:<name>:parameters:<index>:…`)
   * each operation on that path that the parameter applies to.
   */
  #removeConsumer(consumer: StackTrail, documentTrail: StackTrail): string[] {
    switch (this.protocol.type) {
      case 'oas': {
        const [first, , third] = documentTrail.stackTrail

        if ((first === 'paths' || first === 'webhooks') && third === 'parameters') {
          return this.#removePathParameterConsumer(consumer, documentTrail)
        }

        return this.protocol.oasDocument.removeItem(documentTrail) === undefined
          ? []
          : [consumer.toString()]
      }
      case 'gql':
        return this.protocol.gqlDocument.removeItem(documentTrail) === undefined
          ? []
          : [consumer.toString()]
      default: {
        const _exhaustive: never = this.protocol
        throw new Error(`Unhandled protocol type: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  /**
   * A broken path-level parameter applies to every operation on the path
   * except one whose own `parameters` override it by `name` and `in`, the
   * rule `isDroppedByPathParameter` uses for an inline entry. The operations
   * it applies to are removed. The entry is taken out of the shared path item,
   * so the operations that stay hold no ref to it.
   */
  #removePathParameterConsumer(consumer: StackTrail, documentTrail: StackTrail): string[] {
    if (this.protocol.type !== 'oas') {
      return []
    }

    const { oasDocument, documentObject } = this.protocol
    const [first, second, , index] = documentTrail.stackTrail
    const prefix = consumer.stackTrail.slice(
      0,
      consumer.stackTrail.length - documentTrail.stackTrail.length
    )

    const items: unknown =
      first === 'paths'
        ? documentObject.paths
        : 'webhooks' in documentObject
          ? documentObject.webhooks
          : undefined
    const rawPathItem = isPlainObject(items) ? items[second] : undefined
    const rawEntries =
      isPlainObject(rawPathItem) && Array.isArray(rawPathItem.parameters)
        ? rawPathItem.parameters
        : []
    const rawEntry: unknown = rawEntries[Number(index)]
    const entryRef =
      isPlainObject(rawEntry) && typeof rawEntry.$ref === 'string' ? rawEntry.$ref : undefined
    const nameAndIn = toNameAndIn(
      entryRef === undefined
        ? rawEntry
        : toRawRefTarget(documentObject, toRefParts({ $ref: entryRef }))
    )
    const broken = [{ location: documentTrail.toString(), message: '', ...nameAndIn }]

    const operations =
      first === 'paths'
        ? oasDocument.operations.filter(({ path }) => path === second)
        : oasDocument.webhooks.filter(({ name }) => name === second)

    const removedLocations = operations.flatMap(({ method, pathItem }) => {
      const rawOperation = isPlainObject(rawPathItem) ? rawPathItem[method] : undefined

      if (toApplyingBrokenParameter({ broken, operation: rawOperation }) === undefined) {
        if (pathItem?.parameters) {
          pathItem.parameters = pathItem.parameters.filter(parameter =>
            parameter.isRef()
              ? parameter.$ref !== entryRef
              : entryRef !== undefined ||
                parameter.name !== nameAndIn.name ||
                parameter.location !== nameAndIn.in
          )
        }
        return []
      }

      return oasDocument.removeItem(new StackTrail([first, second, method])) === undefined
        ? []
        : [new StackTrail([...prefix, first, second, method]).toString()]
    })

    return removedLocations
  }

  #logDependencyIssue({ location, refKey, rootCause }: LogDependencyIssueArgs): void {
    const { error } = rootCause
    const errorMessage = error instanceof Error ? error.message : String(error)
    const at = rootCause.location === undefined ? '' : ` at '${rootCause.location}'`
    const message = `Depends on '${refKey}', removed because of the error${at}: ${errorMessage}`

    // `logIssueAt` serializes the cause and picks the issue's protocol shape.
    switch (this.protocol.type) {
      case 'oas':
        this.logIssueAt({
          protocol: 'oas',
          level: 'error',
          type: 'INVALID_DEPENDENCY_REF',
          location,
          message,
          cause: error
        })
        break
      case 'gql':
        this.logIssueAt({
          protocol: 'gql',
          level: 'error',
          type: 'INVALID_DEPENDENCY_REF',
          location,
          message,
          cause: error
        })
        break
      default: {
        const _exhaustive: never = this.protocol
        throw new Error(`Unhandled protocol type: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  /**
   * Where `issue` is in the input document, without the run's frames: a
   * JSON Pointer for OAS (`#/paths/~1owners/get`), the dotted path for
   * GraphQL (`Query.post.return`).
   */
  #toDocumentLocation({ protocol, location }: LogIssueAtArgs): string {
    const documentTrail = this.#toDocumentTrail(StackTrail.fromString(location))

    return protocol === 'oas' ? documentTrail.toJsonPointer() : documentTrail.stackTrail.join('.')
  }

  /**
   * `stackTrail` without the frames `parse()` was called with, so it starts
   * at a document key (`components`, `paths`, a GraphQL type name). A trail
   * that does not start with those frames, such as one `log()` builds from a
   * location, is returned unchanged.
   */
  #toDocumentTrail(stackTrail: StackTrail): StackTrail {
    const frames = stackTrail.stackTrail
    const rootFrames = this.#rootFrames
    const startsWithRoot =
      rootFrames.length > 0 &&
      frames.length >= rootFrames.length &&
      rootFrames.every((frame, index) => frames[index] === frame)

    return startsWithRoot ? new StackTrail(frames.slice(rootFrames.length)) : stackTrail
  }

  /**
   * Run `fn` with `currentStackTrail` set to the given trail; restore
   * the previous value afterwards (try/finally semantics). Factories
   * wrap schema-construction in this so `OasBase` can snapshot the
   * trail off the context without each factory threading it
   * explicitly into the constructor.
   *
   * @example
   * ```ts
   * return context.withStackTrail(stackTrail, () =>
   *   new OasBoolean({ title, ... }, context)
   * )
   * ```
   */
  withStackTrail<T>(stackTrail: StackTrail, fn: () => T): T {
    const prev = this.currentStackTrail
    this.currentStackTrail = stackTrail
    try {
      return fn()
    } finally {
      this.currentStackTrail = prev
    }
  }

  /**
   * @internal
   * What each subject of the parsed document can reach through `$ref`s, read
   * from the refs this parse read. Call it when the document is parsed.
   */
  toReach(): Reach {
    const rootDepth = this.#rootFrames.length

    return new Reach(
      this.#oasRefs.map(({ consumer, ref, refTarget }) => ({
        ref,
        place: consumer.stackTrail.slice(rootDepth),
        refTarget
      }))
    )
  }

  /**
   * Register a `$ref`-style consumer site. The key encoding is up to
   * the caller — OAS uses `#/components/schemas/User` strings, GQL
   * would use type names or qualified field paths.
   */
  registerRef(consumer: StackTrail, refKey: string): void {
    const refConsumer = { consumer, refTarget: this.#refTarget }
    const existing = this.#refConsumers.get(refKey)
    if (existing) {
      existing.push(refConsumer)
    } else {
      this.#refConsumers.set(refKey, [refConsumer])
    }
  }

  /**
   * Register an OAS `$ref` at its consumer site, as {@link registerRef}
   * does, under the key {@link toRefKey} gives its `$ref`, and keep the ref
   * with that site, so that once the document is parsed `#checkRefs` can
   * resolve it there.
   */
  registerOasRef<T extends OasRefData['refType']>(consumer: StackTrail, ref: OasRef<T>): void {
    this.registerRef(consumer, toRefKey(ref))
    this.#oasRefs.push({ consumer, ref, refTarget: this.#refTarget })
  }

  /**
   * Resolves each OAS ref once the document is parsed, at each place it is
   * written, and logs an issue there when it does not resolve:
   *
   * - A ref that names nothing logs `DANGLING_REF`: no component has its
   *   name, or it is part of a loop of `$ref`s (`A` is a `$ref` to `B`, and
   *   `B` to `A`), which never reaches a component. When `skmtc.config.json`
   *   `parse.danglingRefs` lists its kind, it is a warning: the ref stays,
   *   and resolving it throws `DanglingRefError` for the generator to handle.
   *   Otherwise (the default, `[]`, lists none) it is an error, and what holds
   *   the ref is removed, with what uses that.
   * - A ref to a component of the wrong kind, such as a request body that is
   *   a `$ref` to `#/components/schemas/Pet`, logs a `REF_TYPE_MISMATCH`
   *   error, and what holds it is removed: the parser hands a generator what
   *   the place promises, or nothing. Resolving a ref throws no other error.
   *
   * A ref whose target failed to parse is left out: the target's error
   * removes what holds it.
   */
  #checkRefs(): void {
    this.#oasRefs.forEach(({ consumer, ref, refTarget }) =>
      this.#inRefTarget(refTarget, () => {
        if (this.#refErrors.has(toRefKey(ref))) {
          return
        }

        const error = this.#toRefError(ref)

        if (error !== undefined) {
          if (!DanglingRefError.is(error)) {
            const message = error instanceof Error ? error.message : String(error)

            this.#removeHolder({
              consumer,
              ref,
              refTarget,
              error,
              type: 'REF_TYPE_MISMATCH',
              message: `${message}, so what holds it is removed.`
            })
          } else if (this.system.danglingRefs?.includes(ref.refType)) {
            this.logIssueNoKey({
              level: 'warning',
              message: `${error.message}. It is kept (parse.danglingRefs lists '${ref.refType}'), and resolving it throws DanglingRefError.`,
              parent: { $ref: ref.$ref },
              stackTrail: consumer,
              type: 'DANGLING_REF'
            })
          } else {
            this.#removeHolder({
              consumer,
              ref,
              refTarget,
              error,
              type: 'DANGLING_REF',
              message: `${error.message}, so what holds it is removed. To keep it, list '${ref.refType}' in parse.danglingRefs.`
            })
          }
        }
      })
    )
  }

  /**
   * Why `ref` does not resolve where it is written, or `undefined` when it
   * does: what `resolveOnce()` throws, or a `DanglingRefError` when `ref` is
   * part of a loop of `$ref`s (`OasRef.toLoop`).
   *
   * A ref that leads into a loop, or to a ref that names nothing or the
   * wrong kind, resolves here: the refs further on report it where they are
   * written, and what holds them goes with what uses it.
   */
  #toRefError(ref: WrittenRef['ref']): unknown {
    try {
      ref.resolveOnce()
    } catch (error) {
      return error
    }

    const loop = this.#toLoopOf(ref)

    return loop === undefined
      ? undefined
      : new DanglingRefError(ref.$ref, { loop: loop.map(({ $ref }) => $ref) })
  }

  /** The loop of `$ref`s that `ref` is part of, or `undefined`. */
  #toLoopOf(ref: WrittenRef['ref']): { $ref: string }[] | undefined {
    try {
      const loop = ref.toLoop()

      return loop?.includes(ref) ? loop : undefined
    } catch {
      // A ref further on names nothing or the wrong kind: it reports that itself.
      return undefined
    }
  }

  /**
   * Logs an error at the place a ref is written and removes what holds it.
   * An error inside a component or a ref target removes it, and what uses it
   * (`removeErroredItems`). What holds the ref outside the components (an
   * operation, a webhook, a path-level parameter) is removed here. Its own
   * location has the error already; an operation that a path-level parameter
   * applies to gets an `INVALID_DEPENDENCY_REF`.
   */
  #removeHolder({ consumer, ref, refTarget, error, type, message }: RemoveHolderArgs): void {
    this.logIssueNoKey({
      level: 'error',
      message,
      cause: error,
      parent: { $ref: ref.$ref },
      stackTrail: consumer,
      type
    })

    const documentTrail = this.#toDocumentTrail(consumer)

    if (refTarget !== undefined || documentTrail.toStackRef() !== undefined) {
      return
    }

    const location = consumer.toString()

    this.#removeConsumer(consumer, documentTrail)
      .filter(removed => removed !== location)
      .forEach(removed =>
        this.#logDependencyIssue({
          location: removed,
          refKey: ref.$ref,
          rootCause: { error, location }
        })
      )
  }

  /**
   * What a merge reads in place of a `$ref` that names nothing: an `allOf`
   * member, or in a `oneOf` or `anyOf`, a member's own `allOf` member or a
   * member merged with the keywords beside the union. When
   * `parse.danglingRefs` lists `allOfMember`, it is `{}`, which
   * adds nothing to the merge (`A & unknown` is `A`), and a `DANGLING_REF`
   * warning at `stackTrail`: the model has no properties from that member.
   * Otherwise it throws `DanglingRefError`, and what holds the `allOf` is
   * removed. It is separate from `schema`: here core decides, at parse, and
   * the generator never sees the member.
   */
  toDanglingAllOfMember({ error, stackTrail }: ToDanglingAllOfMemberArgs): OpenAPIV3.SchemaObject {
    if (!this.system.danglingRefs?.includes('allOfMember')) {
      throw error
    }

    this.logIssueNoKey({
      level: 'warning',
      message: `${error.message}. It is left out of the allOf merge (parse.danglingRefs lists 'allOfMember').`,
      parent: { $ref: error.ref },
      stackTrail,
      type: 'DANGLING_REF'
    })

    return {}
  }

  /**
   * Register an error against a ref key — typically called when the
   * target of a `$ref` (or type reference) fails to parse. `undefined`
   * `refKey` is a deliberate no-op: callers may pass the result of
   * `StackTrail.toStackRef()` directly, which is `undefined` for
   * non-component stack trails. `location` is where the error was logged;
   * each `INVALID_DEPENDENCY_REF` it causes names it.
   */
  registerRefError(error: unknown, refKey: string | undefined, location?: string): void {
    if (!refKey) return
    const refError = { error, location }
    const existing = this.#refErrors.get(refKey)
    if (existing) {
      existing.push(refError)
    } else {
      this.#refErrors.set(refKey, [refError])
    }
  }

  /**
   * Universal issue recorder. Pushes to `issues` and (when not silent)
   * mirrors to the logger. Both protocols' surface methods funnel
   * here.
   *
   * The log line's message is `<TYPE> at <document location>: <message>`,
   * and its `issue` field holds the issue's fields.
   *
   * `parent` is an optional log-time-only field — surface methods
   * forward the surrounding object so log readers see its shape, not
   * just the leaf address. Stringified here so the logger payload
   * stays JSON-clonable. It is intentionally **not** stored on the
   * persisted `ParseIssue` (which would require clone-safe
   * serialization across the worker boundary and would bloat the
   * manifest).
   */
  logIssueAt(issue: LogIssueAtArgs, parent?: unknown): void {
    const added = this.#addIssue(toParseIssue(issue))

    if (added && !this.silent) {
      const message = `${issue.type} at ${this.#toDocumentLocation(issue)}: ${issue.message}`
      const issueArg = new LogLineIssueArg({
        type: issue.type,
        level: issue.level,
        location: issue.location,
        ...(parent === undefined ? {} : { parent: JSON.stringify(parent) })
      })

      // Each issue is logged at its own level, so a log threshold above
      // DEBUG leaves `debug` issues out.
      switch (issue.level) {
        case 'error':
          this.logger.error(message, issueArg)
          break
        case 'warning':
          this.logger.warn(message, issueArg)
          break
        case 'debug':
          this.logger.debug(message, issueArg)
          break
        default: {
          const _exhaustive: never = issue
          throw new Error(`Unhandled issue level: ${JSON.stringify(_exhaustive)}`)
        }
      }
    }
  }

  // -- OAS-flavored surface (StackTrail-based) ---------------------

  logIssue({ key, parent, type, stackTrail, ...issue }: LogIssueArgs): void {
    stackTrail.trace(key, st => this.logIssueNoKey({ parent, type, stackTrail: st, ...issue }))
  }

  logIssueNoKey({ parent, type, stackTrail, ...issue }: LogIssueNoKeyArgs): void {
    const location = stackTrail.toString()
    // Protocol is set from the active context; callers don't have to
    // pass it. `LogIssueAtArgs` discriminates `type` by protocol, so
    // the type-system narrowing happens at the LogIssueAtArgs boundary —
    // we widen here because LogIssueNoKey accepts either protocol's
    // type enum.
    const protocol = this.protocol.type
    // The casts below bridge LogIssueNoKeyArgs (widened type field,
    // covers both protocols) to LogIssueAtArgs (narrowed per
    // protocol). Callers are responsible for passing a `type` from
    // the matching protocol's enum; the stored ParseIssue then
    // carries the correct combination.
    switch (issue.level) {
      case 'error': {
        // Auto-register against the component-shaped ref the trail
        // points at. No-op for non-component trails (and for GQL
        // trails) because `toStackRef` returns `undefined` and
        // `registerRefError` ignores undefined refs.
        this.registerRefError(
          issue.cause ?? issue.message,
          this.#refTarget ?? this.#toDocumentTrail(stackTrail).toStackRef(),
          location
        )
        this.logIssueAt(
          {
            protocol,
            level: 'error',
            type,
            location,
            message: issue.message,
            cause: issue.cause
          } as unknown as LogIssueAtArgs,
          parent
        )
        break
      }
      case 'warning': {
        this.logIssueAt(
          {
            protocol,
            level: 'warning',
            type,
            location,
            message: issue.message
          } as unknown as LogIssueAtArgs,
          parent
        )
        break
      }
      case 'debug': {
        this.logIssueAt(
          {
            protocol,
            level: 'debug',
            type,
            location,
            message: issue.message
          } as unknown as LogIssueAtArgs,
          parent
        )
        break
      }
      default: {
        const _exhaustive: never = issue
        throw new Error(`Unhandled parse-issue level: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  /**
   * Thin convenience for recording an issue at a pre-computed string
   * `location` rather than threading a {@link StackTrail}. Use this
   * for issues whose natural address isn't a tree position:
   *
   *   - Schema-level directive definitions (`@auth`) — flat namespace,
   *     no parent type.
   *   - Catch-all error paths where the parsed entity doesn't exist
   *     yet (the parse threw before producing one).
   *
   * For tree-position issues, prefer {@link logIssueNoKey} so the
   * stack trail composes with the surrounding traces.
   *
   * Internally constructs a `StackTrail` with `StackTrail.fromString(location)`
   * and delegates to {@link logIssueNoKey} — the underlying issue
   * recording logic (protocol tagging, optional ref-error
   * auto-registration, logger mirror with parent context) is shared.
   */
  log({ location, parent, type, ...issue }: LogAtArgs): void {
    const stackTrail = StackTrail.fromString(location)
    this.logIssueNoKey({ stackTrail, parent, type, ...issue })
  }

  /**
   * Records one warning per unrecognized key under `parent`.
   *
   * Each skipped key is traced as a child of `stackTrail` so the
   * resulting issue locations point at the offending property, not
   * the parent. `parentType` is used in the message text
   * (`Unexpected property 'foo' in 'SchemaObject'`); `type` defaults
   * to `UNEXPECTED_PROPERTY` (the OAS convention) but GQL callers can
   * pass a more specific category like `SKIPPED_FIELD_ARGUMENTS`.
   */
  logSkippedFields({
    skipped,
    stackTrail,
    parent,
    parentType,
    type = 'UNEXPECTED_PROPERTY'
  }: LogSkippedValuesArgs): void {
    Object.keys(skipped).forEach(key => {
      this.logIssue({
        key,
        stackTrail,
        parent,
        level: 'warning',
        message: `Unexpected property '${key}' in '${parentType}'`,
        type
      })
    })
  }
}
