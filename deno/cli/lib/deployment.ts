import type { DenoFile } from '@/deploy/types.ts'
import { ApiClient } from '@/lib/api-client.ts'
import type { Manager } from '@/lib/manager.ts'
import { getApiDeploymentsDeploymentId } from '@/services/getApiDeploymentsDeploymentId.generated.ts'
import { getApiDeploymentsDeploymentIdDeploymentLogs } from '@/services/getApiDeploymentsDeploymentIdDeploymentLogs.generated.ts'
import { createApiServers } from '@/services/createApiServers.generated.ts'
import invariant from 'tiny-invariant'
import type { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import type { SkmtcDispatch } from '@/components/SkmtcContext.tsx'

type DeployArgs = {
  serverName: string
  assets: Record<string, DenoFile>
  project: Project
  dispatch: SkmtcDispatch
}

export class Deployment {
  apiClient: ApiClient
  denoDeploymentId?: string

  constructor(manager: Manager) {
    this.apiClient = new ApiClient(manager)
  }

  async deploy({ serverName, assets, project, dispatch }: DeployArgs) {
    dispatch({ type: 'set-execution', payload: { type: 'deploy', title: 'Uploading...' } })

    const serverDeployment = await createApiServers({
      supabase: this.apiClient.manager.auth.supabase,
      body: {
        assets,
        serverName,
        generatorIds: project.toGeneratorIds()
      }
    })

    this.denoDeploymentId = serverDeployment.latestDenoDeploymentId ?? undefined

    dispatch({ type: 'set-execution', payload: { type: 'deploy', title: 'Deploying...' } })

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        invariant(serverDeployment.latestDenoDeploymentId, 'Deno deployment ID is missing')

        const deployment = await getApiDeploymentsDeploymentId({
          deploymentId: serverDeployment.latestDenoDeploymentId,
          supabase: this.apiClient.manager.auth.supabase
        })

        const userName = await this.apiClient.manager.auth.toUserName()

        if (deployment.status === 'success') {
          updateProjectKey({ project, projectKey: `@${userName}/${project.name}` })

          clearInterval(interval)

          dispatch({ type: 'set-execution', payload: null })

          resolve(true)
        }

        if (deployment.status === 'failed') {
          updateProjectKey({ project, projectKey: `@${userName}/${project.name}` })

          clearInterval(interval)

          dispatch({ type: 'set-execution', payload: null })

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

type UpdateProjectKeyArgs = {
  project: Project | RemoteProject
  projectKey: string
}

const updateProjectKey = ({ project, projectKey }: UpdateProjectKeyArgs) => {
  if (project.clientJson.contents) {
    project.clientJson.contents.projectKey = projectKey
  } else {
    project.clientJson.contents = {
      projectKey,
      settings: {}
    }
  }

  project.clientJson.write()
}
