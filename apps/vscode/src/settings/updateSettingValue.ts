import { match, P } from 'ts-pattern'
import { updateClientConfig } from './updateClientConfig'
import { readClientConfig } from '../utilities/readClientConfig'
import { SkmtcClientConfig } from '@skmtc/core/Settings'
import { ExtensionContext } from 'vscode'
import { ExtensionStore } from '../types/ExtensionStore'
import { Method } from '@skmtc/core/Method'
import { Extensions } from '@skmtc/core/Extensions'
import { readExtensions } from '../utilities/readExtensions'
import { updateExtensionsConfig } from './updateExtensionsConfig'
import { setWith } from 'lodash'

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

  const extensions = readExtensions() ?? {}

  updateFromStackTrail({
    stackTrail,
    store,
    context,
    clientConfig,
    extensions,
    value,
    fromForm
  })
}

type GetStackTrailFromNameArgs = {
  stackTrail: string
  store: ExtensionStore
  context: ExtensionContext
  clientConfig: SkmtcClientConfig
  extensions: Extensions
  value: boolean
  fromForm: boolean
}

const updateFromStackTrail = ({
  stackTrail,
  store,
  context,
  clientConfig,
  extensions,
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

          updateClientConfig({
            clientConfig: clientConfig,
            settingPanel: store.settingPanel,
            extensionUri: context.extensionUri,
            fromForm
          })
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
        updateClientConfig({
          clientConfig: clientConfig,
          settingPanel: store.settingPanel,
          extensionUri: context.extensionUri,
          fromForm
        })
      }
    })
    .with(['generators', P._, P._], ([_, generatorId, refName]) => {
      const generatorSettings = clientConfig.settings.generators.find(
        ({ id }) => id === generatorId
      )

      if (generatorSettings && 'models' in generatorSettings) {
        generatorSettings.models[refName] = value

        updateClientConfig({
          clientConfig: clientConfig,
          settingPanel: store.settingPanel,
          extensionUri: context.extensionUri,
          fromForm
        })
      }
    })
    .with(['generators', P._, P._, P._], ([_, generatorId, path, method]) => {
      const generatorSettings = clientConfig.settings.generators.find(
        ({ id }) => id === generatorId
      )

      if (generatorSettings && 'operations' in generatorSettings) {
        generatorSettings.operations[path][method as Method] = value

        updateClientConfig({
          clientConfig: clientConfig,
          settingPanel: store.settingPanel,
          extensionUri: context.extensionUri,
          fromForm
        })
      }
    })
    .with(['schema', ...P.array()], matched => {
      setWith(
        extensions,
        matched.slice(1).concat('__x__', 'extensionFields', name),
        value,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Object
      )

      updateExtensionsConfig({
        extensions,
        extensionUri: context.extensionUri,
        settingPanel: store.settingPanel,
        fromForm
      })
    })
    .otherwise(value => {
      console.log('NO MATCH', value)
      throw new Error('No match')
    })
}
