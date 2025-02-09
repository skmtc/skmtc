import type { ClientSettings } from '../types/Settings.ts'
import type { PrettierConfigType } from '../types/prettierConfig.ts'
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
  toGeneratorConfigMap: <EnrichmentType>() => GeneratorsMapContainer<EnrichmentType>
  startAt: number
}

export const transform = ({
  traceId,
  spanId,
  documentObject,
  settings,
  prettier,
  toGeneratorConfigMap,
  logsPath,
  startAt
}: TransformArgs) => {
  const context = new CoreContext({ spanId, logsPath })

  const { artifacts, files, previews, results } = context.transform({
    settings,
    toGeneratorConfigMap,
    prettier,
    documentObject
  })

  const manifest: ManifestContent = {
    files,
    previews,
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
