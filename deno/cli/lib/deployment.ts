import type { DenoFile } from '../deploy/types.ts'
import type { ClientJson } from './client-json.ts'
import { ApiClient } from './api-client.ts'
import type { Manager } from './manager.ts'
import { Spinner } from './spinner.ts'

type DeployArgs = {
  projectName: string
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

  async deploy({ assets, projectName, generatorIds, clientJson }: DeployArgs) {
    const spinner = new Spinner({ message: 'Uploading...', color: 'yellow' })

    spinner.start()

    const { latestDenoDeploymentId } = await this.apiClient.deploy({
      assets,
      stackName: projectName,
      generatorIds
    })

    this.denoDeploymentId = latestDenoDeploymentId

    spinner.message = 'Deploying...'

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        const deployment = await this.apiClient.getDeploymentInfo(latestDenoDeploymentId)

        if (deployment.status === 'success') {
          clientJson.setDeploymentId(latestDenoDeploymentId)
          clearInterval(interval)
          spinner.stop()
          resolve(true)
        }

        if (deployment.status === 'failed') {
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
