import type { ClientSettings } from '../types/Settings.ts'
import type { PrettierConfigType } from '../types/prettierConfig.ts'
import { CoreContext } from '../context/CoreContext.ts'
import type { OperationGateway, OperationInsertable } from '../dsl/operation/OperationInsertable.ts'
import type { ModelInsertable } from '../dsl/model/ModelInsertable.ts'
import type { ManifestContent } from '../types/Manifest.ts'
import type { GeneratedValue } from '../types/GeneratedValue.ts'

type TransformArgs = {
  traceId: string
  spanId: string
  schema: string
  settings?: ClientSettings
  prettier?: PrettierConfigType
  logsPath?: string
  generatorsMap: Record<
    string,
    OperationGateway | OperationInsertable<GeneratedValue> | ModelInsertable<GeneratedValue>
  >
  startAt: number
}

export const transform = ({
  traceId,
  spanId,
  schema,
  settings,
  prettier,
  generatorsMap,
  logsPath,
  startAt
}: TransformArgs) => {
  const context = new CoreContext({ spanId, logsPath })

  const { artifacts, files, previews, pinnable, results } = context.transform({
    settings,
    generatorsMap,
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
