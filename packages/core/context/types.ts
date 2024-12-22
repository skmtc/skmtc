import type { GeneratorKey } from '../types/GeneratorKeys.ts'
import type { ManifestEntry } from '../types/Manifest.ts'
import type { ResultType } from '../types/Results.ts'

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
  pinnable: Partial<Record<GeneratorKey, string>>
}

export type RenderResult = {
  artifacts: Record<string, string>
  files: Record<string, ManifestEntry>
  previews: Record<string, Record<string, string>>
  pinnable: Partial<Record<GeneratorKey, string>>
  results: Record<string, ResultType>
}
