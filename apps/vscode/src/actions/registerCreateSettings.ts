import { commands, ProgressLocation, window, ExtensionContext } from 'vscode'
import { readSchemaFile } from '../utilities/readSchemaFile'
import { readClientConfig } from '../utilities/readClientConfig'
import { z } from 'zod'
import { clientGeneratorSettings } from '@skmtc/core/Settings'
import { createSettings } from '../api/createSettings'
import { writeClientConfig } from '../utilities/writeClientConfig'
import { ExtensionStore } from '../types/ExtensionStore'
import { readStackConfig } from '../utilities/readStackConfig'

type RegisterCreateSettingsArgs = {
  store: ExtensionStore
  context: ExtensionContext
}

export const registerCreateSettings = ({ store, context }: RegisterCreateSettingsArgs) => {
  return commands.registerCommand('skmtc-vscode.createSettings', ({ selectAll } = {}) => {
    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Generate settings',
        cancellable: false
      },
      async (progress, token) => {
        // token.onCancellationRequested(() => {
        //   console.log('User canceled the long running operation');
        // });

        progress.report({ message: 'running' })

        return new Promise<void>(resolve => {
          callCreateSettings({ store, context })
            .then(() => {
              if (selectAll) {
                commands.executeCommand('skmtc-vscode.selectAll')
              }

              window.showInformationMessage('Settings refreshed successfully')
              resolve()
            })
            .catch(error => {
              window.showErrorMessage(`Failed to refresh settings: ${error}`)
              resolve()
            })
        })
      }
    )
  })
}

const createSettingsRespose = z.object({
  generators: z.array(clientGeneratorSettings),
  extensions: z.record(z.unknown())
})

type CallCreateSettingsArgs = {
  store: ExtensionStore
  context: ExtensionContext
}

const callCreateSettings = async ({ store, context }: CallCreateSettingsArgs) => {
  const clientConfig = readClientConfig({ notifyIfMissing: true })

  if (!clientConfig) {
    return
  }

  const stackConfig = readStackConfig({ notifyIfMissing: true })

  if (!stackConfig?.name) {
    return
  }

  const schema = readSchemaFile({ notifyIfMissing: true })

  if (!schema) {
    return
  }

  const res = await createSettings({
    store,
    schema,
    clientConfig,
    stackName: stackConfig.name,
    context
  })

  const { generators } = createSettingsRespose.parse(res)

  clientConfig.settings.generators = generators

  writeClientConfig(clientConfig)
}
