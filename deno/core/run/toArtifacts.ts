import type { ClientSettings } from '../types/Settings.ts'
import type { PrettierConfigType } from '../types/PrettierConfig.ts'
import { CoreContext } from '../context/CoreContext.ts'
import type { ManifestContent } from '../types/Manifest.ts'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { OpenAPIV3 } from 'openapi-types'
type TransformArgs = {
  traceId: string
  spanId: string
  documentObject: OpenAPIV3.Document
  settings: ClientSettings | undefined
  prettier?: PrettierConfigType
  logsPath?: string
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  startAt: number
  silent: boolean
}

export const toArtifacts = async ({
  traceId,
  spanId,
  documentObject,
  settings,
  prettier,
  toGeneratorConfigMap,
  logsPath,
  startAt,
  silent
}: TransformArgs) => {
  const context = new CoreContext({ spanId, logsPath, silent })

  const { artifacts, files, previews, results, mappings } = await context.toArtifacts({
    settings,
    toGeneratorConfigMap,
    prettier,
    documentObject,
    silent
  })

  const manifest: ManifestContent = {
    files,
    previews,
    mappings,
    traceId,
    spanId,
    results,
    deploymentId: Deno.env.get('DENO_DEPLOYMENT_ID') ?? Date.now().toString(),
    region: Deno.env.get('DENO_REGION'),
    startAt,
    endAt: Date.now()
  }

  return { artifacts, manifest }
}
