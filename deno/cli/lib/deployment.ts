import type { DenoFile } from '../deploy/types.ts'
import type { ClientJson } from './client-json.ts'
import { ApiClient } from './api-client.ts'
import type { Manager } from './manager.ts'
import { Spinner } from './spinner.ts'

type DeployArgs = {
  serverName: string | undefined
  generatorIds: string[]
  assets: Record<string, DenoFile>
  clientJson: ClientJson
}

export class Deployment {
  apiClient: ApiClient
  denoDeploymentId?: string

  constructor(manager: Manager) {
    this.apiClient = new ApiClient(manager)
  }

  async deploy({ assets, serverName, generatorIds, clientJson }: DeployArgs) {
    const spinner = new Spinner({ message: 'Uploading...', color: 'yellow' })

    spinner.start()

    const serverDeployment = await this.apiClient.deploy({
      assets,
      serverName,
      generatorIds
    })

    this.denoDeploymentId = serverDeployment.latestDenoDeploymentId

    spinner.message = 'Deploying...'

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        const deployment = await this.apiClient.getDeploymentInfo(
          serverDeployment.latestDenoDeploymentId
        )

        if (deployment.status === 'success') {
          clientJson.setServerInfo({
            serverName: serverDeployment.stackName,
            deploymentId: serverDeployment.latestDenoDeploymentId
          })

          clearInterval(interval)
          spinner.stop()
          resolve(true)
        }

        if (deployment.status === 'failed') {
          clientJson.setServerInfo({ serverName: serverDeployment.stackName })

          clearInterval(interval)
          spinner.stop()
          reject(false)
        }
      }, 8000)
    })
  }

  async getBuildLogs(denoDeploymentId: string) {
    const buildLogs = await this.apiClient.getBuildLogs(denoDeploymentId)

    return buildLogs
  }
}
