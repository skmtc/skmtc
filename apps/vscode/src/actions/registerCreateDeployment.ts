import { ExtensionContext, window, commands, ProgressLocation, env } from 'vscode'
import { toRootPath } from '../utilities/getRootPath'
import * as fs from 'fs'
import * as path from 'path'
import { createDeployment } from '../api/createDeployment'
import { getDeployment } from '../api/getDeployment'
import { readStackConfig } from '../utilities/readStackConfig'
import { DenoFile } from '../types/File'
import { readClientConfig } from '../utilities/readClientConfig'
import { writeClientConfig } from '../utilities/writeClientConfig'
import { getDeploymentLogs } from '../api/getDeploymentLogs'
import { ExtensionStore } from '../types/ExtensionStore'
import * as Sentry from '@sentry/browser'
import { setCannonicalDeploymentDomainName } from '../api/setCannonicalDeploymentDomainName'
import invariant from 'tiny-invariant'

type RegisterDeployStackArgs = {
  context: ExtensionContext
  store: ExtensionStore
}

type AssetEntry = [string, DenoFile]

export const registerCreateDeployment = ({ context, store }: RegisterDeployStackArgs) => {
  return commands.registerCommand('skmtc-vscode.deployStack', async () => {
    return await Sentry.startSpan({ name: 'Collate content' }, async () => {
      if (store.devMode?.url) {
        // @todo: disable deploy command in dev mode
        window.showErrorMessage(`Cannot deploy in dev mode`)
        return
      }

      const stackConfig = readStackConfig({ notifyIfMissing: true })

      if (!stackConfig) {
        return
      }

      const stackName = stackConfig?.name

      if (!stackName) {
        window.showErrorMessage(`Stack config is missing 'name' property required for deployment`)
        return
      }

      return window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: stackName,
          cancellable: false
        },
        async (progress, token) => {
          // token.onCancellationRequested(() => {
          //   console.log('User canceled the long running operation');
          // });

          progress.report({ message: 'uploading' })

          const assets = await toAssets('.codesquared')

          try {
            const res = await createDeployment({
              assets,
              stackConfig,
              stackName,
              context
            })

            if (res) {
              progress.report({ message: 'deploying' })

              return new Promise<string>(resolve => {
                pollForStatus({
                  resolve,
                  stackName,
                  deploymentId: res.id,
                  store,
                  context
                })
              })
            }
          } catch (error) {
            store.sentryClient.captureException(error)

            await handleDeploymentFailure({ stackName, store, deploymentId: undefined, context })
          }
        }
      )
    })
  })
}

type PollForStatusArgs = {
  resolve: (value: string | PromiseLike<string>) => void
  stackName: string
  deploymentId: string
  store: ExtensionStore
  context: ExtensionContext
}

const pollForStatus = ({ resolve, stackName, deploymentId, store, context }: PollForStatusArgs) => {
  const interval = setInterval(async () => {
    try {
      const res = await getDeployment({ deploymentId, context })

      if (res.status === 'failed') {
        clearInterval(interval)

        await handleDeploymentFailure({ stackName, deploymentId, store, context })

        setTimeout(() => resolve('FAILED'), 0)
      }

      if (res.status === 'success') {
        const canonicalDomainName = await setCannonicalDeploymentDomainName({
          deploymentId,
          context
        })

        console.log('CANONICAL DOMAIN NAME', canonicalDomainName)

        clearInterval(interval)

        await completeDeployment({ deploymentId, stackName })

        setTimeout(() => resolve('SUCCESS'), 0)
      }
    } catch (error) {
      setTimeout(() => handleDeploymentFailure({ stackName, deploymentId, store, context }), 0)

      setTimeout(() => {
        clearInterval(interval)

        resolve('ERROR')
      }, 10)
    }
  }, 3000)
}

type CompleteDeploymentArgs = {
  deploymentId: string
  stackName: string
}

const completeDeployment = async ({ deploymentId, stackName }: CompleteDeploymentArgs) => {
  const clientConfig = readClientConfig({ notifyIfMissing: false }) ?? {
    settings: {
      generators: []
    }
  }

  const message = `${stackName}: release ${deploymentId} deployed`

  window.showInformationMessage(message)

  clientConfig.deploymentId = deploymentId

  writeClientConfig(clientConfig)
}

const toAssets = async (skmtcPath: string): Promise<Record<string, DenoFile>> => {
  const skmtcRoot = path.join(toRootPath(), skmtcPath)

  const fileEntries = fs
    .readdirSync(skmtcRoot, { recursive: true })
    .map((filePath): AssetEntry | undefined => {
      invariant(typeof filePath === 'string', 'expected filePath to be a string')

      if (
        filePath.includes('.DS_Store') ||
        filePath.includes('.prettierrc.json') ||
        filePath.startsWith('logs/')
      ) {
        return
      }

      const resolvedFilePath = path.join(skmtcRoot, filePath)

      if (fs.statSync(resolvedFilePath).isDirectory()) {
        return
      }

      const fileContents = fs.readFileSync(resolvedFilePath, 'utf-8')

      return [
        filePath,
        {
          kind: 'file',
          content: fileContents,
          encoding: 'utf-8'
        }
      ]
    })
    .filter((item): item is AssetEntry => Boolean(item))

  return Object.fromEntries(fileEntries)
}

type HandleDeploymentFailureArgs = {
  stackName: string
  store: ExtensionStore
  deploymentId: string | undefined
  context: ExtensionContext
}

const handleDeploymentFailure = async ({
  stackName,
  store,
  deploymentId,
  context
}: HandleDeploymentFailureArgs) => {
  if (deploymentId) {
    await showDeploymentLogs({ store, deploymentId, context })
  }

  window.showErrorMessage(`${stackName}: Failed to deploy`)
}

type ShowDeploymentLogsArgs = {
  store: ExtensionStore
  deploymentId: string
  context: ExtensionContext
}

const showDeploymentLogs = async ({ deploymentId, store, context }: ShowDeploymentLogsArgs) => {
  await getDeploymentLogs({ deploymentId, store, context })
}
