import type { ManifestEntry } from '@/types/Manifest.ts'
import type { Mapping, Preview } from '@/types/Preview.ts'
import type { ResultsItem } from '@/types/Results.ts'
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { JsonFile } from '@/dsl/JsonFile.ts'
import type { GeneratedValue, GenerationType } from '@/dsl/GeneratedValue.ts'
import type { Definition } from '@/dsl/Definition.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { OperationInsertable } from '@/dsl/operation/types.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'
import type { ModelInsertable } from '@/dsl/model/types.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { ImportNameArg } from '@/dsl/Import.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { RefName } from '@/types/RefName.ts'
import type { SchemaToNonRef, TypeSystemOutput } from '@/types/TypeSystem.ts'
import type { File } from '@/dsl/File.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { StackTrail } from './StackTrail.ts'
/**
 * Options for inserting an operation into the generation context.
 *
 * Configures how an OpenAPI operation should be processed and
 * included in the generated code output.
 *
 * @template T - The generation type extending GenerationType
 */
export type InsertOperationOptions<T extends GenerationType> = {
  /** Whether to exclude this operation from exports */
  noExport?: boolean
  /** The type of generation to apply */
  generation?: T
  /** Custom destination path for the operation */
  destinationPath?: string
}

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
  previews: Record<string, Record<string, Preview>>
  /** Mapping data for file relationships */
  mappings: Record<string, Record<string, Mapping>>
  /** Hierarchical results tracking */
  results: ResultsItem
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
  definitions?: (Definition | undefined)[]
}

/**
 * Union type representing any supported OpenAPI document version.
 */
export type AnyOasDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document

/**
 * Types of issues that can be encountered during OpenAPI schema parsing.
 */
export type IssueType =
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

export type GenerateResult = {
  files: Map<string, File | JsonFile>
  previews: Record<string, Record<string, Preview>>
  mappings: Record<string, Record<string, Mapping>>
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
  definitions?: (Definition | undefined)[]
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
export type InsertNormalisedModelArgs<Schema extends OasSchema | OasRef<'schema'> | OasVoid> = {
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
 * @template T - The generation type extending GenerationType
 */
export type InsertModelOptions<T extends GenerationType> = {
  /** Whether to exclude this model from exports */
  noExport?: boolean
  /** The type of generation to apply */
  generation?: T
  /** Custom destination path for the model */
  destinationPath?: string
}

/**
 * Options for inserting a normalized model.
 */
export type InsertNormalisedModelOptions = {
  /** Whether to exclude this model from exports */
  noExport?: boolean
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
export type BuildModelSettingsArgs<V, EnrichmentType = undefined> = {
  refName: RefName
  insertable: ModelInsertable<V, EnrichmentType>
}

/**
 * Arguments for generating operation content settings.
 *
 * @template V - The value type for the operation
 * @template EnrichmentType - Optional enrichment type for the operation
 */
export type ToOperationSettingsArgs<V, EnrichmentType = undefined> = {
  operation: OasOperation
  insertable: OperationInsertable<V, EnrichmentType>
}

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
export type InsertNormalisedModelReturn<
  V extends GeneratedValue,
  Schema extends OasSchema | OasRef<'schema'> | OasVoid
> =
  Schema extends OasRef<'schema'>
    ? Definition<V>
    : Definition<TypeSystemOutput<SchemaToNonRef<Schema>['type']>>

export type GenerateContextType = {
  settings: ClientSettings | undefined
  modelDepth: Record<string, number>
  toArtifacts: (stackTrail: StackTrail) => GenerateResult
  defineAndRegister: <V extends GeneratedValue>({
    identifier,
    value,
    destinationPath,
    noExport
  }: DefineAndRegisterArgs<V>) => Definition<V>
  registerJson: ({ destinationPath, json }: RegisterJsonArgs) => void
  register: ({ imports, definitions, destinationPath, reExports }: RegisterArgs) => void
  insertOperation: <V extends GeneratedValue, T extends GenerationType, EnrichmentType = undefined>(
    insertable: OperationInsertable<V, EnrichmentType>,
    operation: OasOperation,
    { generation, destinationPath, noExport }: InsertOperationOptions<T>
  ) => Inserted<V, T, EnrichmentType>
  insertNormalisedModel: <
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType
  >(
    insertable: ModelInsertable<V, EnrichmentType>,
    { schema, fallbackName, destinationPath }: InsertNormalisedModelArgs<Schema>,
    { noExport }: InsertNormalisedModelOptions
  ) => InsertNormalisedModelReturn<V, Schema>
  insertModel: <V extends GeneratedValue, T extends GenerationType, EnrichmentType>(
    insertable: ModelInsertable<V, EnrichmentType>,
    refName: RefName,
    { generation, destinationPath, noExport }: InsertModelOptions<T>
  ) => Inserted<V, T, EnrichmentType>
  toOperationContentSettings: <V, EnrichmentType>({
    operation,
    insertable
  }: ToOperationSettingsArgs<V, EnrichmentType>) => ContentSettings<EnrichmentType>
  toModelContentSettings: <V, EnrichmentType>({
    refName,
    insertable
  }: BuildModelSettingsArgs<V, EnrichmentType>) => ContentSettings<EnrichmentType>
  resolveSchemaRefOnce: (refName: RefName, generatorId: string) => OasSchema | OasRef<'schema'>
  findDefinition: ({ name, exportPath }: PickArgs) => Definition | undefined
}
