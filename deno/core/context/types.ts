import type { GeneratorKey } from '../types/GeneratorKeys.ts'
import type { ManifestEntry } from '../types/Manifest.ts'
import type { Preview } from '../types/Preview.ts'
import type { ResultType } from '../types/Results.ts'
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { SchemaOption } from '../types/SchemaOptions.ts'
export type PhaseType = 'parse' | 'generate' | 'render'

export type GetFileOptions = {
  throwIfNotFound?: boolean
}

export type AddGeneratorKeyArgs = {
  generatorKey: GeneratorKey
}

export type FilesRenderResult = {
  artifacts: Record<string, string>
  files: Record<string, ManifestEntry>
}

export type RenderResult = {
  artifacts: Record<string, string>
  files: Record<string, ManifestEntry>
  previews: Record<string, Record<string, Preview>>
  schemaOptions: SchemaOption[]
  results: Record<string, ResultType>
}

export type AnyOasDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document
