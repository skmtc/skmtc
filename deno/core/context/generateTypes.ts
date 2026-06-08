import * as v from 'valibot'
import type { ManifestEntry } from '@/types/Manifest.ts'
import type { ParseIssue } from '@/context/ParseIssue.ts'
import type { Mapping, Preview } from '@/types/Preview.ts'
import type { ResultsItem } from '@/types/Results.ts'
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { JsonFile } from '@/dsl/JsonFile.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { Definition, DefinitionBase } from '@/dsl/Definition.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { OasOperationProjection } from '@/dsl/operation/oas/types.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'
import type { ModelProjection } from '@/dsl/model/types.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { ImportNameArg } from '@/dsl/Import.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { RefName } from '@/types/RefName.ts'
import type { SchemaToNonRef, TypeSystemOutput } from '@/types/TypeSystem.ts'
import type { File } from '@/dsl/File.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { StackTrail } from './StackTrail.ts'
import type { GqlOperationProjection } from '@/dsl/operation/gql/types.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { SkmtcParsedDocument } from '@/types/SkmtcDocument.ts'
import type { AttributionState } from '@/types/AttributionState.ts'
import type { Sidecar } from '@/anchors/sidecar.ts'
import type { GenerationMapEntry } from '@/anchors/generationMap.ts'

/**
 * Options for inserting an operation into the generation context.
 *
 * Configures how an OpenAPI operation should be processed and
 * included in the generated code output.
 *
 * @template T - The generation type extending GenerationType
 */
export type InsertOperationOptions = {
  /** Whether to exclude this operation from exports */
  noExport?: boolean
  /** Custom destination path for the operation */
  destinationPath?: string
  /**
   * Target variant of the peer projection. Omit for `'main'` (the
   * universally-safe default that every peer is guaranteed to
   * honour). Pass explicitly only when the peer declares this
   * variant — the Driver throws on mismatch.
   */
  variant?: string
}

/**
 * Arguments for `GenerateContext.insertOperation`.
 *
 * @template V - Generated value type
 * @template EnrichmentType - Optional enrichment data type
 */
export type InsertOasOperationArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  /** The operation projection to insert */
  projection: OasOperationProjection<V, EnrichmentType>
  /** The OpenAPI operation to process */
  operation: OasOperation
  /** Custom destination path for the operation */
  destinationPath?: string
  /** Whether to exclude this operation from exports */
  noExport?: boolean
  /**
   * Target variant of the peer projection. Omit for the canonical
   * `'main'` variant — the only variant guaranteed to exist on every
   * peer. Pass explicitly only when threading a caller's variant
   * deliberately; the Driver throws if the requested variant isn't
   * declared in the peer's enrichments.
   */
  variant?: string
}

/**
 * Arguments for `GenerateContext.insertOperation`.
 *
 * @template V - Generated value type
 * @template EnrichmentType - Optional enrichment data type
 */
export type InsertGqlOperationArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  /** The operation projection to insert */
  projection: GqlOperationProjection<V, EnrichmentType>
  /** The GraphQL operation to process */
  operation: GqlOperation
  /** Custom destination path for the operation */
  destinationPath?: string
  /** Whether to exclude this operation from exports */
  noExport?: boolean
  /**
   * Target variant of the peer projection. Omit for the canonical
   * `'main'` variant — the only variant guaranteed to exist on every
   * peer. Pass explicitly only when threading a caller's variant
   * deliberately; the Driver throws if the requested variant isn't
   * declared in the peer's enrichments.
   */
  variant?: string
}

export type InsertOperationArgs<V extends GeneratedValue, EnrichmentType = undefined> =
  | InsertOasOperationArgs<V, EnrichmentType>
  | InsertGqlOperationArgs<V, EnrichmentType>

/**
 * Type representing the three phases of the SKMTC pipeline.
 */
export type PhaseType = 'parse' | 'generate' | 'render'

/**
 * Options for retrieving files from the context.
 */
export type GetFileOptions = {
  /** Whether to throw an error if the file is not found */
  throwIfNotFound?: boolean
}

/**
 * Result of rendering files in the context.
 */
export type FilesRenderResult = {
  /** Map of file paths to rendered content */
  artifacts: Record<string, string>
  /** Map of file paths to metadata */
  files: Record<string, ManifestEntry>
}

/**
 * Complete result of the rendering phase including all generated content and metadata.
 */
export type RenderResult = {
  /** Map of file paths to rendered content */
  artifacts: Record<string, string>
  /** Map of file paths to metadata */
  files: Record<string, ManifestEntry>
  /** Preview data for generated content */
  previews: Record<string, Preview>
  /** Mapping data for file relationships */
  mappings: Record<string, Mapping>
  /** Hierarchical results tracking */
  results: ResultsItem
}

/**
 * Return shape of `CoreContext.toArtifacts` — the {@link RenderResult}
 * plus the parse-time {@link ParseIssue} list collected from whichever
 * protocol-specific parse context ran. Lives here rather than on
 * `RenderResult` because the render phase itself doesn't produce
 * parse issues; they're collected one phase earlier.
 */
export type ToArtifactsResult = RenderResult & {
  parseIssues: ParseIssue[]
  /**
   * Per-file gen-maps sidecars. Populated only when
   * `attribution.postPass` was configured on `ToArtifactsArgs`;
   * otherwise omitted. Keys are the original file paths (the CLI
   * writes them under `<basePath>/../.skmtc/<project>/.maps/`).
   */
  sidecars?: Record<string, Sidecar>
  /**
   * Per-Definition generation-map entries gathered across every
   * sidecar. Used for reverse queries ("which files came from refName
   * X?"). Populated only when `attribution.postPass` was configured.
   */
  generationMap?: GenerationMapEntry[]
}

/**
 * Base arguments for registering generated content in the generation context.
 *
 * Provides the fundamental configuration options for registering imports,
 * re-exports, and definitions that will be included in generated files.
 */
export type BaseRegisterArgs = {
  /** Import statements to include, organized by module path */
  imports?: Record<string, ImportNameArg[]>
  /** Re-export statements to include, organized by module path */
  reExports?: Record<string, Identifier[]>
  /** Definition objects to include in the generated content */
  definitions?: (DefinitionBase | undefined)[]
}

/**
 * Union type representing any supported OpenAPI document version.
 */
export type AnyOasDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document

/**
 * Types of issues that can be encountered during OpenAPI schema parsing.
 *
 * The TS type and the valibot schema below stay in sync via the
 * `v.GenericSchema<OasIssueType>` annotation — adding a variant in one
 * place without the other fails to type-check.
 */
export type OasIssueType =
  | 'UNEXPECTED_PROPERTY'
  | 'MISSING_OBJECT_TYPE'
  | 'MISSING_STRING_TYPE'
  | 'MISSING_ARRAY_TYPE'
  | 'MISSING_BOOLEAN_TYPE'
  | 'INVALID_EXAMPLE'
  | 'INVALID_ENUM'
  | 'INVALID_DEFAULT'
  | 'INVALID_NULLABLE'
  | 'UNEXPECTED_FORMAT'
  | 'INVALID_RESPONSE'
  | 'INVALID_FORMAT'
  | 'INVALID_OPERATION'
  | 'INVALID_SCHEMA'
  | 'INVALID_PARAMETER'
  | 'INVALID_DEPENDENCY_REF'
  | 'EXAMPLE_AND_EXAMPLES_DEFINED'

/**
 * Valibot schema for {@link OasIssueType}. Annotation deliberately omitted
 * so the precise literal-union output type flows through to consumers
 * (e.g. the `parseIssue` schema in `types/Manifest.ts`). Drift between
 * this list and {@link OasIssueType} is caught by `assertSchemaMatchesType`
 * below.
 */
export const oasIssueType = v.union([
  v.literal('UNEXPECTED_PROPERTY'),
  v.literal('MISSING_OBJECT_TYPE'),
  v.literal('MISSING_STRING_TYPE'),
  v.literal('MISSING_ARRAY_TYPE'),
  v.literal('MISSING_BOOLEAN_TYPE'),
  v.literal('INVALID_EXAMPLE'),
  v.literal('INVALID_ENUM'),
  v.literal('INVALID_DEFAULT'),
  v.literal('INVALID_NULLABLE'),
  v.literal('UNEXPECTED_FORMAT'),
  v.literal('INVALID_RESPONSE'),
  v.literal('INVALID_FORMAT'),
  v.literal('INVALID_OPERATION'),
  v.literal('INVALID_SCHEMA'),
  v.literal('INVALID_PARAMETER'),
  v.literal('INVALID_DEPENDENCY_REF'),
  v.literal('EXAMPLE_AND_EXAMPLES_DEFINED')
])

// Compile-time drift detector: this binding fails to type-check if
// `OasIssueType` and the literal list above disagree in either
// direction (added/removed/typoed variant).
const _oasIssueTypeDriftCheck: v.GenericSchema<OasIssueType> = oasIssueType
void _oasIssueTypeDriftCheck

export type GenerateResult = {
  files: Map<string, File | JsonFile>
  previews: Record<string, Preview>
  mappings: Record<string, Mapping>
}

/**
 * Arguments for registering a JSON file in the generation context.
 *
 * Used to register JSON configuration files, manifests, or other JSON
 * data that should be included in the generated output artifacts.
 */
export type RegisterJsonArgs = {
  /** The destination file path where the JSON should be written */
  destinationPath: string
  /** The JSON object to write to the file */
  json: Record<string, unknown>
}

/**
 * Arguments for defining and registering a value in the generation context.
 *
 * Used to create definitions from pre-generated values and register them
 * in the generation context for inclusion in output files.
 *
 * @template V - The generated value type extending GeneratedValue
 */
export type DefineAndRegisterArgs<V extends GeneratedValue> = {
  /** The identifier for the definition */
  identifier: Identifier
  /** The generated value to define */
  value: V
  /** The destination file path where the definition should be registered */
  destinationPath: string
  /** Whether to exclude this definition from exports */
  noExport?: boolean
}

/**
 * Arguments for registering generated content with a specific destination.
 *
 * Extends BaseRegisterArgs to include a destination path, allowing content
 * to be registered and associated with a specific output file location.
 */
export type RegisterArgs = {
  /** Import statements to include, organized by module path */
  imports?: Record<string, ImportNameArg[]>
  /** Re-export statements to include, organized by module path */
  reExports?: Record<string, Identifier[]>
  /** Definition objects to include in the generated content */
  definitions?: (DefinitionBase | undefined)[]
  /** The destination file path where the content should be registered */
  destinationPath: string
}

/**
 * Arguments for inserting a normalized model into the generation context.
 *
 * Used to process and register OpenAPI schema objects as normalized
 * model definitions with fallback naming when schema names are unavailable.
 *
 * @template Schema - The schema type (OasSchema, OasRef, or OasVoid)
 */
export type InsertNormalizedModelArgs<Schema extends OasSchema | OasRef<'schema'> | OasVoid> = {
  /** Fallback name to use if the schema doesn't have a name */
  fallbackName: string
  /** The OpenAPI schema to normalize and insert */
  schema: Schema
  /** The destination file path for the model */
  destinationPath: string
}

/**
 * Options for inserting a model into the generation context.
 *
 * Configures how a model should be processed and included in
 * the generated code output.
 *
 */
export type InsertModelOptions = {
  /** Whether to exclude this model from exports */
  noExport?: boolean
  /** Custom destination path for the model */
  destinationPath?: string
  /**
   * Target variant of the peer model projection. Omit for `'main'`
   * (the universally-safe default that every peer is guaranteed to
   * honour). Pass explicitly only when the peer declares this
   * variant — the Driver throws on mismatch.
   */
  variant?: string
}

/**
 * Options for inserting a normalized model.
 */
export type InsertNormalizedModelOptions = {
  /** Whether to exclude this model from exports */
  noExport?: boolean
  /**
   * Target variant of the peer model projection (`$ref` branch only).
   * Omit for `'main'`. The inline-schema branch ignores this option
   * because its Definition is one-off — bake the variant into
   * `fallbackName` if you need variant-distinct inline schemas.
   */
  variant?: string
}

/**
 * Arguments for picking a specific export from a generator module.
 *
 * Used to select and configure specific exports from generator modules
 * during the artifact generation process.
 */
export type PickArgs = {
  /** The name of the export to pick from the generator module */
  name: string
  /** The file path where the export should be made available */
  exportPath: string
}

/**
 * Arguments for building model content settings.
 *
 * @template V - The value type for the model
 * @template EnrichmentType - Optional enrichment type for the model
 */
export type BuildModelSettingsArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  refName: RefName
  projection: ModelProjection<V, EnrichmentType>
  /**
   * Model variant whose enrichment / identifier / export path
   * should be resolved (see {@link Variant}). Threaded from the
   * Driver into the projection's static methods and the
   * {@link ContentSettings} built for this insertion.
   */
  variant: string
}

/**
 * Arguments for generating OAS operation content settings.
 *
 * @template V - The value type for the operation
 * @template EnrichmentType - Optional enrichment type for the operation
 */
export type ToOasOperationSettingsArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  operation: OasOperation
  projection: OasOperationProjection<V, EnrichmentType>
  /**
   * Operation variant whose enrichment / identifier / export path
   * should be resolved (see {@link Variant}). Threaded from the
   * Driver into the projection's static methods and the
   * {@link ContentSettings} built for this insertion.
   */
  variant: string
}

/**
 * Arguments for generating GraphQL operation content settings.
 *
 * @template V - The value type for the operation
 * @template EnrichmentType - Optional enrichment type for the operation
 */
export type ToGqlOperationSettingsArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  operation: GqlOperation
  projection: GqlOperationProjection<V, EnrichmentType>
  /**
   * Operation variant whose enrichment / identifier / export path
   * should be resolved (see {@link Variant}).
   */
  variant: string
}

/**
 * Arguments accepted by `GenerateContext.toOperationContentSettings`.
 *
 * Discriminated by the runtime shape of `operation` — OAS operations carry
 * an `oasType: 'operation'` discriminator; GraphQL operations carry
 * `oasType: 'gqlOperation'`. The dispatcher narrows on this discriminator
 * to look up the right enrichment path and identifier.
 */
export type ToOperationSettingsArgs<V extends GeneratedValue, EnrichmentType = undefined> =
  | ToOasOperationSettingsArgs<V, EnrichmentType>
  | ToGqlOperationSettingsArgs<V, EnrichmentType>

/**
 * Return type for inserting a normalized model.
 *
 * Provides type-safe return values based on the schema type being processed.
 * Returns different Definition types depending on whether the schema is a
 * reference or a concrete schema.
 *
 * @template V - The generated value type
 * @template Schema - The schema type being processed
 */
export type InsertNormalizedModelReturn<
  V extends GeneratedValue,
  Schema extends OasSchema | OasRef<'schema'> | OasVoid
> =
  Schema extends OasRef<'schema'>
    ? Definition<V>
    : Definition<TypeSystemOutput<SchemaToNonRef<Schema>['type']>>

export type GenerateContextType = {
  settings: ClientSettings | undefined
  modelDepth: Record<string, number>
  document: SkmtcParsedDocument
  /**
   * Attribution (gen-maps) state. When set, every `SnippetBase`
   * instance wraps its `toString` to record parent/child edges in a
   * module-level render stack, so the post-render span resolver can
   * attribute byte ranges to producers. When omitted, the wrap is
   * skipped entirely — zero cost.
   */
  attribution?: AttributionState
  toArtifacts: (stackTrail: StackTrail) => GenerateResult
  defineAndRegister: <V extends GeneratedValue>({
    identifier,
    value,
    destinationPath,
    noExport
  }: DefineAndRegisterArgs<V>) => Definition<V>
  registerJson: ({ destinationPath, json }: RegisterJsonArgs) => void
  register: ({ imports, definitions, destinationPath, reExports }: RegisterArgs) => void
  insertOperation: <V extends GeneratedValue, EnrichmentType = undefined>(
    args: InsertOperationArgs<V, EnrichmentType>
  ) => Inserted<V, EnrichmentType>
  insertNormalizedModel: <
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType
  >(
    projection: ModelProjection<V, EnrichmentType>,
    { schema, fallbackName, destinationPath }: InsertNormalizedModelArgs<Schema>,
    options?: InsertNormalizedModelOptions
  ) => InsertNormalizedModelReturn<V, Schema>
  insertModel: <V extends GeneratedValue, EnrichmentType>(
    projection: ModelProjection<V, EnrichmentType>,
    refName: RefName,
    options?: InsertModelOptions
  ) => Inserted<V, EnrichmentType>
  toOperationContentSettings: <V extends GeneratedValue, EnrichmentType>({
    operation,
    projection
  }: ToOperationSettingsArgs<V, EnrichmentType>) => ContentSettings<EnrichmentType>
  toModelContentSettings: <V extends GeneratedValue, EnrichmentType>({
    refName,
    projection,
    variant
  }: BuildModelSettingsArgs<V, EnrichmentType>) => ContentSettings<EnrichmentType>
  resolveSchemaRefOnce: (refName: RefName, generatorId: string) => OasSchema | OasRef<'schema'>
  findDefinition: ({ name, exportPath }: PickArgs) => DefinitionBase | undefined
}
