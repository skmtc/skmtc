import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { OasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import type { WebhookEntry } from '@/dsl/webhook/toWebhookEntry.ts'
import type { GqlOperationEntry } from '@/dsl/operation/gql/toGqlOperationEntry.ts'
import type { ModelEntry } from '@/dsl/model/toModelEntry.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { toSchemaComponentRef, type RefParts } from '@/helpers/refFns.ts'
import type { RefName } from '@/types/RefName.ts'
import type { Method } from '@/types/Method.ts'
import type {
  IncludeModelRefs,
  IncludePaths,
  SkipModelRefs,
  SkipPaths
} from '@/types/Settings.ts'
import type {
  GqlOperationSource,
  ModelSource,
  OasOperationSource,
  PreviewModule,
  WebhookSource
} from '@/types/Preview.ts'

/** A generator entry, the run's context and one variant: what a subject is asked with. */
type AskArgs<Entry> = {
  entry: Entry
  context: GenerateContextType
  variant: string
}

type ToSourceArgs = {
  generatorId: string
  variant: string
}

/**
 * One subject of a run: an OpenAPI operation, a webhook, a GraphQL operation
 * or a model. It is the one place that knows how its kind differs from the
 * others: where its results and its enrichments are, what a message calls
 * it, which filter names it, and how an entry of its kind is called with it.
 * The run asks every kind the same questions, in the same order.
 *
 * @template Entry - The generator entry of the subject's kind
 * @template Filter - One generator's `settings.include` or `settings.skip`
 *   filter for the kind; `never` for a kind that has none
 */
export type Subject<Entry, Filter> = {
  /** Its frame or frames below the generator's in a trail, and so its place in `manifest.results`. */
  readonly trail: string | string[]
  /** Where its enrichments are below a generator's id. A variant's name follows. */
  readonly enrichmentPath: string[]
  /** What a message calls it. */
  readonly label: string
  isSupported(args: AskArgs<Entry>): boolean
  /** Whether a filter of `settings.include` or `settings.skip` names this variant of it. */
  matches(filter: Filter | undefined, variant: string): boolean
  transform(args: AskArgs<Entry>): void
  toPreviewModule(args: AskArgs<Entry>): PreviewModule | undefined
  toSource(args: ToSourceArgs): OasOperationSource | WebhookSource | GqlOperationSource | ModelSource
}

/** An OpenAPI operation as a subject. Its results and enrichments are at `[path][method]`. */
export class OasOperationSubject implements Subject<OasOperationEntry, IncludePaths | SkipPaths> {
  operation: OasOperation
  trail: string[]
  enrichmentPath: string[]
  label: string

  constructor(operation: OasOperation) {
    this.operation = operation
    this.trail = [operation.path, operation.method]
    this.enrichmentPath = this.trail
    this.label = `${operation.method.toUpperCase()} ${operation.path}`
  }

  isSupported({ entry, context, variant }: AskArgs<OasOperationEntry>): boolean {
    return (
      typeof entry.isSupported !== 'function' ||
      entry.isSupported({ operation: this.operation, context, variant })
    )
  }

  matches(filter: IncludePaths | SkipPaths | undefined, variant: string): boolean {
    const { path, method } = this.operation

    return matchesPathFilter({ paths: filter, path, method, variant })
  }

  transform({ entry, context, variant }: AskArgs<OasOperationEntry>): void {
    entry.transform({ context, operation: this.operation, variant })
  }

  toPreviewModule({ entry, context, variant }: AskArgs<OasOperationEntry>): PreviewModule | undefined {
    return entry.toPreviewModule?.({ context, operation: this.operation, variant })
  }

  toSource({ generatorId, variant }: ToSourceArgs): OasOperationSource {
    return toOasOperationSource({ operation: this.operation, generatorId, variant })
  }
}

/**
 * A 3.1 webhook as a subject. Its results are at `['webhook'][name][method]`
 * and its enrichments at `[name][method]`. A filter has the shape of an
 * operation's, with the webhook's name in the place of the path.
 */
export class WebhookSubject implements Subject<WebhookEntry, IncludePaths | SkipPaths> {
  webhook: OasWebhook
  trail: string[]
  enrichmentPath: string[]
  label: string

  constructor(webhook: OasWebhook) {
    this.webhook = webhook
    this.trail = ['webhook', webhook.name, webhook.method]
    this.enrichmentPath = [webhook.name, webhook.method]
    this.label = `webhook '${webhook.name}' (${webhook.method.toUpperCase()})`
  }

  isSupported({ entry, context, variant }: AskArgs<WebhookEntry>): boolean {
    return (
      typeof entry.isSupported !== 'function' ||
      entry.isSupported({ webhook: this.webhook, context, variant })
    )
  }

  matches(filter: IncludePaths | SkipPaths | undefined, variant: string): boolean {
    const { name, method } = this.webhook

    return matchesPathFilter({ paths: filter, path: name, method, variant })
  }

  transform({ entry, context, variant }: AskArgs<WebhookEntry>): void {
    entry.transform({ context, webhook: this.webhook, variant })
  }

  toPreviewModule({ entry, context, variant }: AskArgs<WebhookEntry>): PreviewModule | undefined {
    return entry.toPreviewModule?.({ context, webhook: this.webhook, variant })
  }

  toSource({ generatorId, variant }: ToSourceArgs): WebhookSource {
    return toWebhookSource({ webhook: this.webhook, generatorId, variant })
  }
}

/**
 * A GraphQL operation as a subject. Its results and enrichments are at
 * `[rootKind][fieldName]`. `settings.include` and `settings.skip` have no
 * filter for a GraphQL operation, so no filter names it.
 */
export class GqlOperationSubject implements Subject<GqlOperationEntry, never> {
  operation: GqlOperation
  trail: string[]
  enrichmentPath: string[]
  label: string

  constructor(operation: GqlOperation) {
    this.operation = operation
    this.trail = [operation.rootKind, operation.fieldName]
    this.enrichmentPath = this.trail
    this.label = `${operation.rootKind} ${operation.fieldName}`
  }

  isSupported({ entry, context, variant }: AskArgs<GqlOperationEntry>): boolean {
    return (
      typeof entry.isSupported !== 'function' ||
      entry.isSupported({ operation: this.operation, context, variant })
    )
  }

  matches(): boolean {
    return false
  }

  transform({ entry, context, variant }: AskArgs<GqlOperationEntry>): void {
    entry.transform({ context, operation: this.operation, variant })
  }

  toPreviewModule({ entry, context, variant }: AskArgs<GqlOperationEntry>): PreviewModule | undefined {
    return entry.toPreviewModule?.({ context, operation: this.operation, variant })
  }

  toSource({ generatorId, variant }: ToSourceArgs): GqlOperationSource {
    return toGqlOperationSource({ operation: this.operation, generatorId, variant })
  }
}

/** A model as a subject: a schema component of either protocol. Its results and enrichments are at `[refName]`. */
export class ModelSubject implements Subject<ModelEntry, IncludeModelRefs | SkipModelRefs> {
  refName: RefName
  ref: RefParts
  trail: string
  enrichmentPath: string[]
  label: string

  constructor(refName: RefName) {
    this.refName = refName
    this.ref = toSchemaComponentRef(refName)
    this.trail = refName
    this.enrichmentPath = [refName]
    this.label = refName
  }

  isSupported({ entry, context, variant }: AskArgs<ModelEntry>): boolean {
    return (
      typeof entry.isSupported !== 'function' ||
      entry.isSupported({ ref: this.ref, context, variant })
    )
  }

  matches(filter: IncludeModelRefs | SkipModelRefs | undefined, variant: string): boolean {
    return matchesRefFilter({ refs: filter, refName: this.refName, variant })
  }

  transform({ entry, context, variant }: AskArgs<ModelEntry>): void {
    entry.transform({ context, ref: this.ref, variant })
  }

  toPreviewModule({ entry, context, variant }: AskArgs<ModelEntry>): PreviewModule | undefined {
    return entry.toPreviewModule?.({ context, ref: this.ref, variant })
  }

  toSource({ generatorId, variant }: ToSourceArgs): ModelSource {
    return toModelSource({ refName: this.refName, generatorId, variant })
  }
}

type MatchesPathFilterArgs = {
  paths: SkipPaths | IncludePaths | undefined
  path: string
  method: Method
  variant: string
}

/**
 * Match a `(path, method, variant)` tuple against an operation-shaped
 * skip or include entry. Shared by both arms because skip and include
 * have the same matching rules; only the engine's interpretation of
 * the result differs (skip = deny, include = allow).
 *
 * Returns `false` when:
 * - `paths` is `undefined` (no filter applies)
 * - the `path` isn't keyed in the entry
 * - the `method` isn't present in the inner record
 *
 * Returns `true` when:
 * - the method's variant array is empty (matches every variant)
 * - the method's variant array contains `variant`
 */
const matchesPathFilter = ({ paths, path, method, variant }: MatchesPathFilterArgs): boolean => {
  if (!paths) {
    return false
  }

  const methodMap = paths[path]
  if (!methodMap) {
    return false
  }

  const variants = methodMap[method]
  if (variants === undefined) {
    return false
  }

  if (variants.length === 0) {
    return true
  }

  return variants.includes(variant)
}

type MatchesRefFilterArgs = {
  refs: SkipModelRefs | IncludeModelRefs | undefined
  refName: string
  variant: string
}

/**
 * Match a `(refName, variant)` tuple against a model-shaped skip or
 * include entry. Sibling to {@link matchesPathFilter} — both arms
 * share matching rules; only the engine's interpretation of the
 * result differs (skip = deny, include = allow).
 *
 * Returns `false` when:
 * - `refs` is `undefined` (no filter applies)
 * - the `refName` isn't keyed in the entry
 *
 * Returns `true` when:
 * - the refName's variant array is empty (matches every variant)
 * - the refName's variant array contains `variant`
 */
const matchesRefFilter = ({ refs, refName, variant }: MatchesRefFilterArgs): boolean => {
  if (!refs) {
    return false
  }

  const variants = refs[refName]
  if (variants === undefined) {
    return false
  }

  if (variants.length === 0) {
    return true
  }

  return variants.includes(variant)
}

type ToOasOperationSourceArgs = {
  operation: OasOperation
  generatorId: string
  /** Operation variant the artifact was emitted for (see {@link Variant}) */
  variant: string
}

/**
 * Creates an OasOperationSource from an operation, generator ID, and variant.
 *
 * Transforms operation and generator information into a source descriptor
 * that can be used for tracking operation origins in the generation pipeline.
 *
 * @param args - Arguments containing operation, generator ID, and variant
 * @returns OasOperationSource descriptor for the operation
 */
export const toOasOperationSource = ({
  operation,
  generatorId,
  variant
}: ToOasOperationSourceArgs): OasOperationSource => ({
  type: 'oasOperation',
  generatorId,
  operationPath: operation.path,
  operationMethod: operation.method,
  variant
})

type ToWebhookSourceArgs = {
  webhook: OasWebhook
  generatorId: string
  /** Webhook variant the artifact was emitted for (see {@link Variant}) */
  variant: string
}

/**
 * Creates a {@link WebhookSource} from a webhook, generator ID, and variant.
 * Sibling of {@link toOasOperationSource} for the 3.1 webhook subject.
 */
export const toWebhookSource = ({
  webhook,
  generatorId,
  variant
}: ToWebhookSourceArgs): WebhookSource => ({
  type: 'webhook',
  generatorId,
  webhookName: webhook.name,
  webhookMethod: webhook.method,
  variant
})

type ToGqlOperationSourceArgs = {
  operation: GqlOperation
  generatorId: string
  /** Operation variant the artifact was emitted for (see {@link Variant}) */
  variant: string
}

/**
 * Creates a GraphQL operation source descriptor.
 *
 * Sibling to {@link toOasOperationSource} for the GraphQL protocol — encodes
 * `rootKind` and `fieldName` instead of `path` / `method`.
 */
export const toGqlOperationSource = ({
  operation,
  generatorId,
  variant
}: ToGqlOperationSourceArgs): GqlOperationSource => ({
  type: 'gqlOperation',
  generatorId,
  rootKind: operation.rootKind,
  fieldName: operation.fieldName,
  variant
})

type ToModelSourceArgs = {
  refName: RefName
  generatorId: string
  /** Model variant the artifact was emitted for (see {@link Variant}) */
  variant: string
}

/**
 * Creates a ModelSource from a reference name, generator ID, and variant.
 *
 * Transforms model reference and generator information into a source descriptor
 * that can be used for tracking model origins in the generation pipeline.
 *
 * @param args - Arguments containing reference name, generator ID, and variant
 * @returns ModelSource descriptor for the model
 */
export const toModelSource = ({
  refName,
  generatorId,
  variant
}: ToModelSourceArgs): ModelSource => ({
  type: 'model',
  generatorId,
  refName,
  variant
})
