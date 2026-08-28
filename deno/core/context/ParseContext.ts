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
 * `removeErroredItems` is universal but its body dispatches on
 * `protocol.type` — the cleanup step is document-shaped. The GQL branch
 * is a no-op stub today; the infrastructure (the `#refConsumers` /
 * `#refErrors` maps, `registerRef` / `registerRefError`) is in place
 * for GQL parsers to populate when type-reference invalidation is
 * needed.
 */

import type { OpenAPIV3 } from 'openapi-types'
import { buildSchema, type GraphQLSchema } from 'graphql'
import { toDocumentFieldsV3 } from '@/parse/v3-0/document/toDocumentFieldsV3.ts'
import { toDocumentFieldsV3 as toDocumentFieldsV31 } from '@/parse/v3-1/document/toDocumentFieldsV3.ts'
import { toOasDialect } from '@/parse/toOasDialect.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import type { RefName } from '@/types/RefName.ts'
import { toSchemaExpansion } from '@/context/SchemaExpansion.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { parseGqlDocument } from '@/gql/document/parseGqlDocument.ts'
import type { Logger } from '@/types/Logger.ts'
export type { AttributionState } from '@/types/AttributionState.ts'
import { StackTrail } from '@/context/StackTrail.ts'
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

// Re-exports kept here for backwards-compat with the previous flat
// surface. New parser helpers should `import type` from
// `./parseTypes.ts` (input/arg shapes) or `./ParseIssue.ts`
// (issue / protocol enums); the class itself stays here.
export type { GqlIssueType, ParseIssue } from '@/context/ParseIssue.ts'
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

  // Universal dependency-ref tracking. Populated by parsers as they
  // encounter references. OAS uses `$ref` strings as keys; GQL would
  // use type names. The maps don't care about the encoding.
  #refConsumers: Map<string, StackTrail[]> = new Map()
  #refErrors: Map<string, unknown[]> = new Map()

  constructor({ input, logger, silent = true, options }: ConstructorArgs) {
    this.logger = logger
    this.silent = silent

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
   * wrapped in {@link SkmtcParsedDocument}. `stackTrail` is required
   * for OAS (used by `toDocumentFieldsV3` for issue location tracking)
   * and ignored by GQL (which uses pre-computed schema addresses).
   */
  parse(stackTrail: StackTrail): SkmtcParsedDocument {
    switch (this.protocol.type) {
      case 'oas': {
        const oasState = this.protocol
        // The ONE place the OpenAPI version is examined: pick the dialect's
        // parser tree. Everything downstream is version-specific code living
        // in its own tree (v3-0 / v3-1) and never re-checks the version.
        const dialect = toOasDialect(oasState.documentObject.openapi)
        switch (dialect) {
          case '3.0':
            oasState.oasDocument.fields = toDocumentFieldsV3({
              documentObject: oasState.documentObject,
              stackTrail,
              context: this
            })
            break
          case '3.1':
            oasState.oasDocument.fields = toDocumentFieldsV31({
              documentObject: oasState.documentObject,
              stackTrail,
              context: this
            })
            break
          default: {
            const _exhaustive: never = dialect
            throw new Error(`Unhandled OAS dialect: ${JSON.stringify(_exhaustive)}`)
          }
        }
        this.#registerSynthesizedSchemas(oasState.oasDocument)
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
   * Walks any registered ref errors and prunes their consumers from
   * the parsed document. Symmetric across protocols: OAS prunes via
   * `OasDocument.removeItem`, GQL via `GqlDocument.removeItem`. Each
   * pruned consumer yields an `INVALID_DEPENDENCY_REF` issue.
   *
   * Pruning is deliberately **single-level** — only the direct
   * consumers of a parse-errored schema are removed. Anything those
   * removals leave with a dangling reference is left in place: if a
   * generator never resolves it, it is harmless; if one does, that
   * single artifact fails at generate time and is isolated there. We
   * do not cascade transitively.
   *
   * Known coarseness, intentionally left as-is for now: a `paths:P:M:…`
   * consumer trail resolves to the *whole operation*, so an operation
   * that references a broken schema is pruned even when the reference
   * is only through a response it does not generate from. A finer
   * design — don't prune operations for response-position refs and let
   * generate-time isolation handle the dangling ref — is deferred; the
   * single-level + generate-time-isolation contract above keeps the
   * dangling ref safe in the meantime.
   */
  /**
   * Schemas the parser named itself — recursive inline `allOf`s that a
   * `$ref` now points at (see `SchemaExpansion`) — become components, so
   * those refs resolve through `components.schemas` like any other. Runs
   * once the whole document is walked: operations are parsed before
   * components, and either can hold the `allOf` in question.
   */
  #registerSynthesizedSchemas(document: OasDocument): void {
    const entries = toSchemaExpansion(this).synthesizedEntries()

    if (entries.length === 0) {
      return
    }

    const components = document.components ?? new OasComponents({})

    for (const [name, node] of entries) {
      components.addSchema(name as RefName, node)
    }

    if (document.components === undefined) {
      document.fields = { ...document.fields, components }
    }
  }

  removeErroredItems(): void {
    switch (this.protocol.type) {
      case 'oas': {
        const oasState = this.protocol
        for (const [refKey, errors] of this.#refErrors) {
          for (const error of errors) {
            const consumers = this.#refConsumers.get(refKey) ?? []
            for (const stackTrail of consumers) {
              const removed = oasState.oasDocument.removeItem(stackTrail)
              if (removed) {
                this.issues.push({
                  protocol: 'oas',
                  level: 'error',
                  type: 'INVALID_DEPENDENCY_REF',
                  location: stackTrail.toString(),
                  message: error instanceof Error ? error.message : String(error),
                  cause: error
                })
              }
            }
          }
        }
        break
      }
      case 'gql': {
        const gqlState = this.protocol
        for (const [refKey, errors] of this.#refErrors) {
          for (const error of errors) {
            const consumers = this.#refConsumers.get(refKey) ?? []
            for (const stackTrail of consumers) {
              const removed = gqlState.gqlDocument.removeItem(stackTrail)
              if (removed) {
                this.issues.push({
                  protocol: 'gql',
                  level: 'error',
                  type: 'INVALID_DEPENDENCY_REF',
                  location: stackTrail.toString(),
                  message: error instanceof Error ? error.message : String(error),
                  cause: error
                })
              }
            }
          }
        }
        break
      }
      default: {
        const _exhaustive: never = this.protocol
        throw new Error(`Unhandled protocol type: ${JSON.stringify(_exhaustive)}`)
      }
    }
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
   * Register a `$ref`-style consumer site. The key encoding is up to
   * the caller — OAS uses `#/components/schemas/User` strings, GQL
   * would use type names or qualified field paths.
   */
  registerRef(consumer: StackTrail, refKey: string): void {
    const existing = this.#refConsumers.get(refKey)
    if (existing) {
      existing.push(consumer)
    } else {
      this.#refConsumers.set(refKey, [consumer])
    }
  }

  /**
   * Register an error against a ref key — typically called when the
   * target of a `$ref` (or type reference) fails to parse. `undefined`
   * `refKey` is a deliberate no-op: callers may pass the result of
   * `StackTrail.toStackRef()` directly, which is `undefined` for
   * non-component stack trails.
   */
  registerRefError(error: unknown, refKey: string | undefined): void {
    if (!refKey) return
    const existing = this.#refErrors.get(refKey)
    if (existing) {
      existing.push(error)
    } else {
      this.#refErrors.set(refKey, [error])
    }
  }

  /**
   * Universal issue recorder. Pushes to `issues` and (when not silent)
   * mirrors to the logger. Both protocols' surface methods funnel
   * here.
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
    this.issues.push(issue)

    if (!this.silent) {
      this.logger.warn({
        protocol: issue.protocol,
        level: issue.level,
        location: issue.location,
        message: issue.message,
        type: issue.type,
        ...(parent === undefined ? {} : { parent: JSON.stringify(parent) })
      })
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
        this.registerRefError(issue.cause ?? issue.message, stackTrail.toStackRef())
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
   * Internally constructs a `StackTrail` from `location.split(':')`
   * and delegates to {@link logIssueNoKey} — the underlying issue
   * recording logic (protocol tagging, optional ref-error
   * auto-registration, logger mirror with parent context) is shared.
   */
  log({ location, parent, type, ...issue }: LogAtArgs): void {
    const stackTrail = new StackTrail(location.split(':'))
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
