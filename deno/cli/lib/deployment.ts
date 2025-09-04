import type { DenoFile } from '../deploy/types.ts'
import type { ClientJson } from './client-json.ts'
import { ApiClient } from './api-client.ts'
import type { Manager } from './manager.ts'
import { Spinner } from './spinner.ts'
import { getApiDeploymentsDeploymentId } from '../services/getApiDeploymentsDeploymentId.generated.ts'
import { getApiDeploymentsDeploymentIdDeploymentLogs } from '../services/getApiDeploymentsDeploymentIdDeploymentLogs.generated.ts'
import { createApiServers } from '../services/createApiServers.generated.ts'
import invariant from 'tiny-invariant'

type DeployArgs = {
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

  async deploy({ assets, generatorIds, clientJson }: DeployArgs) {
    const spinner = new Spinner({ message: 'Uploading...', color: 'yellow' })

    spinner.start()

    const serverDeployment = await createApiServers({
      supabase: this.apiClient.manager.auth.supabase,
      body: {
        assets,
        stackName: clientJson.contents.serverName ?? null,
        generatorIds
      }
    })

    this.denoDeploymentId = serverDeployment.latestDenoDeploymentId ?? undefined

    spinner.message = 'Deploying...'

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        invariant(serverDeployment.latestDenoDeploymentId, 'Deno deployment ID is missing')

        const deployment = await getApiDeploymentsDeploymentId({
          deploymentId: serverDeployment.latestDenoDeploymentId,
          supabase: this.apiClient.manager.auth.supabase
        })

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
          reject('Deployment failed')
        }
      }, 8000)
    })
  }

  async getBuildLogs(denoDeploymentId: string) {
    const buildLogs = await getApiDeploymentsDeploymentIdDeploymentLogs({
      deploymentId: denoDeploymentId,
      supabase: this.apiClient.manager.auth.supabase
    })

    return buildLogs
  }
}
