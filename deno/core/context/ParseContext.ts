/**
 * Unified parse context for both OAS and GraphQL inputs.
 *
 * One class, two protocol-specific states behind a discriminated union.
 * Universal capabilities (issue collection, logger mirroring,
 * dependency-ref tracking) live at the top of the class and apply to
 * both protocols. Protocol-specific state (`oasDocument` vs
 * `schema`/`registry`) sits on `this.protocol`, narrowed by
 * `this.protocol.type`. The OAS-flavoured logging surface
 * (`logIssue`/`logIssueNoKey`/`logSkippedFields`) accepts a
 * {@link StackTrail} for location; the GQL-flavoured surface (`log`,
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
import { toDocumentFieldsV3 } from '@/oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { parseGqlDocument } from '@/gql/document/parseGqlDocument.ts'
import type { Logger } from '@/types/Logger.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type {
  SkmtcDocumentInput,
  SkmtcParsedDocument
} from '@/types/SkmtcDocument.ts'
import type {
  GqlParseIssueInput,
  GqlParseOptions,
  LogIssueArgs,
  LogIssueAtArgs,
  LogIssueNoKeyArgs,
  LogSkippedFieldsAtArgs,
  LogSkippedValuesArgs
} from '@/context/parseTypes.ts'
import type { ParseIssue } from '@/context/ParseIssue.ts'

// Re-exports kept here for backwards-compat with the previous flat
// surface. New parser helpers should `import type` from
// `./parseTypes.ts` (input/arg shapes) or `./ParseIssue.ts`
// (issue / protocol enums); the class itself stays here.
export type { ParseIssue, GqlIssueType } from '@/context/ParseIssue.ts'
export type {
  GqlParseError,
  GqlParseIssueInput,
  GqlParseOptions,
  GqlParseWarning,
  LogIssueArgs,
  LogIssueAtArgs,
  LogIssueNoKeyArgs,
  LogSkippedFieldsAtArgs,
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
        const schema =
          typeof input.value === 'string' ? buildSchema(input.value) : input.value
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
   * constructing `OasRef`s via `registry.createRef(refName, document)`
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
        oasState.oasDocument.fields = toDocumentFieldsV3({
          documentObject: oasState.documentObject,
          stackTrail,
          context: this
        })
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
   */
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
   */
  logIssueAt(issue: LogIssueAtArgs): void {
    this.issues.push(issue)

    if (!this.silent) {
      this.logger.warn({
        protocol: issue.protocol,
        level: issue.level,
        location: issue.location,
        message: issue.message,
        type: issue.type
      })
    }
  }

  // -- OAS-flavoured surface (StackTrail-based) ---------------------

  logIssue({ key, parent, type, stackTrail, ...issue }: LogIssueArgs): void {
    stackTrail.trace(key, st =>
      this.logIssueNoKey({ parent, type, stackTrail: st, ...issue })
    )
  }

  logIssueNoKey({ parent: _parent, type, stackTrail, ...issue }: LogIssueNoKeyArgs): void {
    const location = stackTrail.toString()
    switch (issue.level) {
      case 'error': {
        this.registerRefError(issue.error, stackTrail.toStackRef())
        this.logIssueAt({
          protocol: 'oas',
          level: 'error',
          type,
          location,
          message: issue.error.message,
          cause: issue.error
        })
        break
      }
      case 'warning': {
        this.logIssueAt({
          protocol: 'oas',
          level: 'warning',
          type,
          location,
          message: issue.message
        })
        break
      }
      default: {
        const _exhaustive: never = issue
        throw new Error(`Unhandled parse-issue level: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  // -- GQL-flavoured surface (location-string based) ----------------

  /**
   * GQL-flavoured issue recorder. Same effect as
   * {@link logIssueAt}, with protocol pre-set and the location passed
   * through verbatim. Named `log` for backwards-compatibility with
   * the previous `GqlParseContext.log()` surface that GQL parser code
   * already calls.
   */
  log(issue: GqlParseIssueInput): void {
    switch (issue.level) {
      case 'error':
      case 'warning': {
        this.logIssueAt({ protocol: 'gql', ...issue })
        break
      }
      default: {
        const _exhaustive: never = issue
        throw new Error(`Unhandled gql parse-issue level: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  /**
   * Overloaded skipped-fields recorder.
   *
   * - With a `stackTrail` (OAS form): each skipped key becomes an
   *   `UNEXPECTED_PROPERTY` warning logged via the StackTrail-based
   *   `logIssue` pathway, preserving the existing OAS behaviour.
   * - With a `location` (GQL form): each skipped key becomes a
   *   warning at that location, with the configurable issue type
   *   (defaults to `SKIPPED_FEATURE`).
   *
   * Discriminating on the presence of `stackTrail` lets both surfaces
   * call the same method name without forcing protocol-specific
   * renames at parser call sites.
   */
  logSkippedFields(args: LogSkippedValuesArgs | LogSkippedFieldsAtArgs): void {
    if ('stackTrail' in args) {
      const { skipped, stackTrail, parent, parentType } = args
      Object.keys(skipped).forEach(key => {
        this.logIssue({
          key,
          stackTrail,
          parent,
          level: 'warning',
          message: `Unexpected property '${key}' in '${parentType}'`,
          type: 'UNEXPECTED_PROPERTY'
        })
      })
      return
    }

    const { skipped, location, parentType, type = 'SKIPPED_FEATURE' } = args
    for (const key of Object.keys(skipped)) {
      this.log({
        level: 'warning',
        location,
        message: `Unhandled '${key}' on '${parentType}' — value not represented in generated output`,
        type
      })
    }
  }
}

