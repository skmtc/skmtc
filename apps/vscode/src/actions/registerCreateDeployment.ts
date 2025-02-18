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

export const registerCreateDeployment = ({ store }: RegisterDeployStackArgs) => {
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
              stackName
            })

            if (res) {
              progress.report({ message: 'deploying' })

              return new Promise<string>(resolve => {
                pollForStatus({
                  resolve,
                  stackName,
                  deploymentId: res.id,
                  store
                })
              })
            }
          } catch (error) {
            store.sentryClient.captureException(error)

            await handleDeploymentFailure({ stackName, store, deploymentId: undefined })
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
}

const pollForStatus = ({ resolve, stackName, deploymentId, store }: PollForStatusArgs) => {
  const interval = setInterval(async () => {
    try {
      const res = await getDeployment({ deploymentId })

      if (res.status === 'failed') {
        clearInterval(interval)

        await handleDeploymentFailure({ stackName, deploymentId, store })

        setTimeout(() => resolve('FAILED'), 0)
      }

      if (res.status === 'success') {
        const canonicalDomainName = await setCannonicalDeploymentDomainName({ deploymentId })

        console.log('CANONICAL DOMAIN NAME', canonicalDomainName)

        clearInterval(interval)

        await completeDeployment({ deploymentId, stackName })

        setTimeout(() => resolve('SUCCESS'), 0)
      }
    } catch (error) {
      setTimeout(() => handleDeploymentFailure({ stackName, deploymentId, store }), 0)

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

      const resolvedFilePath = path.join(skmtcRoot, filePath)

      if (resolvedFilePath.includes('.DS_Store') || resolvedFilePath.includes('.prettierrc.json')) {
        return
      }

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
}

const handleDeploymentFailure = async ({
  stackName,
  store,
  deploymentId
}: HandleDeploymentFailureArgs) => {
  if (deploymentId) {
    await showDeploymentLogs({ store, deploymentId })
  }

  window.showErrorMessage(`${stackName}: Failed to deploy`)
}

type ShowDeploymentLogsArgs = {
  store: ExtensionStore
  deploymentId: string
}

const showDeploymentLogs = async ({ deploymentId, store }: ShowDeploymentLogsArgs) => {
  await getDeploymentLogs({ deploymentId, store })
}
