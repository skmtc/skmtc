import type { ClientSettings } from '../types/Settings.ts'
import type { PrettierConfigType } from '../types/prettierConfig.ts'
import { CoreContext } from '../context/CoreContext.ts'
import type { ManifestContent } from '../types/Manifest.ts'
import type { GeneratorsMap, GeneratorType } from '../types/GeneratorType.ts'

type TransformArgs = {
  traceId: string
  spanId: string
  schema: string
  settings: ClientSettings | undefined
  prettier?: PrettierConfigType
  logsPath?: string
  toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<
    GeneratorType<EnrichmentType>,
    EnrichmentType
  >
  startAt: number
}

export const transform = ({
  traceId,
  spanId,
  schema,
  settings,
  prettier,
  toGeneratorsMap,
  logsPath,
  startAt
}: TransformArgs) => {
  const context = new CoreContext({ spanId, logsPath })

  const { artifacts, files, previews, pinnable, results } = context.transform({
    settings,
    toGeneratorsMap,
    prettier,
    schema
  })

  const manifest: ManifestContent = {
    files,
    previews,
    pinnable,
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
