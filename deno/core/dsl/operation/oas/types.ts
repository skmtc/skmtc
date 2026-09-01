import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { DefinitionContainer } from '@/dsl/DefinitionContainer.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'

/**
 * External constructor signature for an OAS operation projection class.
 *
 * The pipeline calls `new SomeProjection(args)` with this shape; the
 * runtime base class injects `generatorKey` before calling `super()`.
 */
export type OasOperationProjectionConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

export type TransformOasOperationArgs = {
  context: GenerateContextType
  operation: OasOperation
  /**
   * The operation variant the engine is dispatching for this call. The
   * engine fans out one `transform` call per variant declared in the
   * consumer's `enrichments[id][path][method]` block (or just `'main'`
   * when no enrichments are configured). See {@link Variant}.
   */
  variant: string
}

export type WithTransformOasOperation = {
  transformOperation: (operation: OasOperation) => void
}

export type IsSupportedOasOperationArgs = {
  context: GenerateContextType
  operation: OasOperation
  /** Operation variant being probed (see {@link Variant}) */
  variant: string
}

export type ToOasOperationEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContextType
  /** Operation variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

export type ToOasOperationPreviewModuleArgs = {
  context: GenerateContextType
  operation: OasOperation
  /** Operation variant the preview module describes (see {@link Variant}) */
  variant: string
}

export type ToOasOperationMappingArgs = {
  context: GenerateContextType
  operation: OasOperation
  /** Operation variant the mapping module describes (see {@link Variant}) */
  variant: string
}

/**
 * Arguments for an OAS operation projection's `toIdentifierName` — the
 * pure, cache-key-source half of the old `toIdentifier`.
 */
export type ToOasOperationIdentifierNameArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  enrichments: EnrichmentType
  /** Operation variant the identifier should disambiguate (see {@link Variant}) */
  variant: string
}

/**
 * Arguments for a projection's `toGeneratorKey` static. `settings` carries
 * the identifier, enrichments and variant the key may be built from.
 */
export type ToGeneratorKeyArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  settings: ContentSettings<EnrichmentType>
}

/**
 * Arguments for a container projection's `toGroupName` static — the same
 * `(operation, enrichments, variant)` its identity siblings receive.
 */
export type ToOasOperationGroupNameArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  enrichments: EnrichmentType
  /** Variant the group belongs to (see {@link Variant}) */
  variant: string
}

/**
 * Arguments for a member projection's `toContainer` static — the same
 * `(operation, enrichments, variant)` its identity siblings receive, and run
 * on the same cache-check path, so it must be pure and cheap.
 */
export type ToOasOperationContainerArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  enrichments: EnrichmentType
  /** Variant the placement should disambiguate (see {@link Variant}) */
  variant: string
}

export type ToOasOperationExportPathArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  enrichments: EnrichmentType
  /** Operation variant the export path should disambiguate (see {@link Variant}) */
  variant: string
}

/**
 * Static structural type of a container projection class — a projection
 * whose VALUE holds definitions.
 *
 * Nothing is declared: the constraint is the value's own type, so a
 * projection whose value has no member store is not assignable here. That is
 * the same contract a file satisfies
 * ({@link import('@/dsl/DefinitionContainer.ts').DefinitionContainer}), which
 * is what makes both of them places.
 */
// deno-lint-ignore no-explicit-any
export type OasOperationContainerProjection<EnrichmentType = any> =
  & OasOperationProjection<GeneratedValue & DefinitionContainer, EnrichmentType>
  & {
    /** The group its members share — what its key is made of. */
    toGroupName: (args: ToOasOperationGroupNameArgs<EnrichmentType>) => string
    /** Required here: a container is keyed on its group, never its subject. */
    toGeneratorKey: (args: ToGeneratorKeyArgs<EnrichmentType>) => GeneratorKey
  }

/**
 * Static structural type of an OAS operation projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifierName`, `toIdentifierType`, `toExportPath`,
 * `toEnrichments`). Passed as a type parameter to
 * `context.insertOperation(...)`.
 */
export type OasOperationProjection<V extends GeneratedValue, EnrichmentType = undefined> = {
  prototype: V
} & {
  new ({ context, settings, operation }: OasOperationProjectionConstructorArgs<EnrichmentType>): V
  id: string
  type: 'oasOperation'
  /**
   * The projection's language — the static inherited from the language
   * snippet base the projection class is built on
   * (`toOasOperationProjectionBase(TsSnippet, …)`). Drivers read
   * it ephemerally at each use site, pre-construction (cache-hit path).
   */
  lang: Lang
  /** Pure: the cache-key name. */
  toIdentifierName: (args: ToOasOperationIdentifierNameArgs<EnrichmentType>) => string
  /**
   * Context-aware, overridable: the non-`name` parts of the identifier,
   * derived from the operation/schema. The engine assembles
   * `lang.toIdentifier({ name: toIdentifierName(args),
   * ...toIdentifierType(operation, context) })`.
   */
  toIdentifierType: (operation: OasOperation, context: GenerateContextType) => IdentifierType
  toExportPath: (args: ToOasOperationExportPathArgs<EnrichmentType>) => string
  /**
   * How this projection's key is computed. A subject's projection keys on
   * its subject; a container keys on the group its members share. The Driver
   * reads it rather than branching on which kind it holds.
   *
   * Optional, like {@link isSupported}: a hand-rolled projection may omit it
   * and is keyed on its subject, which is what every projection did before
   * containers existed.
   */
  toGeneratorKey?: (args: ToGeneratorKeyArgs<EnrichmentType>) => GeneratorKey
  /**
   * The declaration this projection's definition is inserted into, rather
   * than the file. Absent for a top-level definition — the common case.
   *
   * A member's file is its container's, so `toExportPath` is not consulted
   * when this is present.
   */
  toContainer?: (
    args: ToOasOperationContainerArgs<EnrichmentType>
  ) => OasOperationContainerProjection
  toEnrichments: ({ operation, context }: ToOasOperationEnrichmentsArgs) => EnrichmentType
  /**
   * Family-level capability predicate, surfaced as a static by
   * `toOasOperationProjectionBase` (default `() => true`). The Driver
   * probes it on every `insertOperation` so a peer is never handed an
   * operation it has declared unsupported. Optional: a hand-rolled
   * projection may omit it, in which case it is treated as supporting
   * every operation.
   */
  isSupported?: (args: IsSupportedOasOperationArgs) => boolean
  // deno-lint-ignore ban-types
} & Function
