import { match, P } from 'ts-pattern'
import { readClientConfig } from '../utilities/readClientConfig'
import { SkmtcClientConfig } from '@skmtc/core/Settings'
import { ExtensionContext } from 'vscode'
import { ExtensionStore } from '../types/ExtensionStore'
import { Method } from '@skmtc/core/Method'
import { writeClientConfig } from '../utilities/writeClientConfig'

type UpdateSettingValueArgs = {
  stackTrail: string
  value: boolean
  fromForm: boolean
  store: ExtensionStore
  context: ExtensionContext
}

export const updateSettingValue = ({
  store,
  context,
  stackTrail,
  value,
  fromForm
}: UpdateSettingValueArgs) => {
  const clientConfig = readClientConfig({ notifyIfMissing: true })

  if (!clientConfig) {
    return
  }

  updateFromStackTrail({
    stackTrail,
    store,
    context,
    clientConfig,
    value,
    fromForm
  })
}

type GetStackTrailFromNameArgs = {
  stackTrail: string
  store: ExtensionStore
  context: ExtensionContext
  clientConfig: SkmtcClientConfig
  value: boolean
  fromForm: boolean
}

const updateFromStackTrail = ({
  stackTrail,
  store,
  context,
  clientConfig,
  value,
  fromForm
}: GetStackTrailFromNameArgs) => {
  const chunks = stackTrail.split(':')

  const name = chunks.pop()

  if (!name) {
    throw new Error('No name')
  }

  match(chunks)
    .with(['generators'], () => {
      match(name)
        .with('basePath', () => {
          clientConfig.settings.basePath = String(value)

          writeClientConfig(clientConfig)
        })
        .otherwise(() => {
          throw new Error('No match')
        })
    })
    .with(['generators', P._], ([_, generatorId]) => {
      const generatorSettings = clientConfig.settings.generators.find(
        ({ id }) => id === generatorId
      )

      if (generatorSettings) {
        writeClientConfig(clientConfig)
      }
    })
    .with(['generators', P._, P._], ([_, generatorId, refName]) => {
      const generatorSettings = clientConfig.settings.generators.find(
        ({ id }) => id === generatorId
      )

      if (generatorSettings && 'models' in generatorSettings) {
        generatorSettings.models[refName].selected = value

        writeClientConfig(clientConfig)
      }
    })
    .with(['generators', P._, P._, P._], ([_, generatorId, path, method]) => {
      const generatorSettings = clientConfig.settings.generators.find(
        ({ id }) => id === generatorId
      )

      if (generatorSettings && 'operations' in generatorSettings) {
        generatorSettings.operations[path][method as Method] = {
          ...generatorSettings.operations[path][method as Method],
          selected: value
        }

        writeClientConfig(clientConfig)
      }
    })
    .otherwise(value => {
      console.log('NO MATCH', value)
      throw new Error('No match')
    })
}
