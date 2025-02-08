import { match, P } from 'ts-pattern'
import { readClientConfig } from '../utilities/readClientConfig'
import { SkmtcClientConfig } from '@skmtc/core/Settings'
import { Method } from '@skmtc/core/Method'
import { writeClientConfig } from '../utilities/writeClientConfig'

type UpdateSettingValueArgs = {
  stackTrail: string
  value: boolean
}

export const updateSettingValue = ({ stackTrail, value }: UpdateSettingValueArgs) => {
  const clientConfig = readClientConfig({ notifyIfMissing: true })

  if (!clientConfig) {
    return
  }

  updateFromStackTrail({
    stackTrail,
    clientConfig,
    value
  })
}

type GetStackTrailFromNameArgs = {
  stackTrail: string
  clientConfig: SkmtcClientConfig
  value: boolean
}

const updateFromStackTrail = ({ stackTrail, clientConfig, value }: GetStackTrailFromNameArgs) => {
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
