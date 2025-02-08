import { OperationsGeneratorSettings, SkmtcClientConfig } from '@skmtc/core/Settings'
import type { Method } from '@skmtc/core/Method'

export const getOperationGeneratorSettings = (
  clientConfig: SkmtcClientConfig | undefined,
  generatorId: string
): OperationsGeneratorSettings | undefined => {
  if (!clientConfig) {
    return undefined
  }

  const generatorSettings = clientConfig.settings.generators.find(
    generator => generator.id === generatorId
  )

  if (generatorSettings && 'operations' in generatorSettings) {
    return generatorSettings
  }

  return undefined
}

type GetOperationSettingArgs = {
  clientConfig: SkmtcClientConfig | undefined
  generatorId: string
  path: string
  method: Method
}

export const getOperationSelected = ({
  clientConfig,
  generatorId,
  path,
  method
}: GetOperationSettingArgs): boolean | undefined => {
  const operationGeneratorConfg = getOperationGeneratorSettings(clientConfig, generatorId)

  return operationGeneratorConfg?.operations?.[path]?.[method]?.selected
}
