import type { GeneratorKey } from '../types/GeneratorKeys.ts'
import type { ManifestEntry } from '../types/Manifest.ts'
import type { Mapping, Preview } from '../types/Preview.ts'
import type { ResultsItem } from '../types/Results.ts'
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

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
