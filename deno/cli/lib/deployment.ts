import type { DenoFile } from '@/deploy/types.ts'
import { ApiClient } from '@/lib/api-client.ts'
import type { Manager } from '@/lib/manager.ts'
import { getApiDeploymentsDeploymentIdDeploymentLogs } from '@/services/getApiDeploymentsDeploymentIdDeploymentLogs.generated.ts'
import invariant from 'tiny-invariant'
import type { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import type { SkmtcDispatch } from '@/components/SkmtcContext.tsx'
import { deploySandboxApi } from '../services/deploySandboxApi.ts'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'

type DeployArgs = {
  serverName: string
  assets: Record<string, DenoFile>
  project: Project
  state: SkmtcState
  dispatch: SkmtcDispatch
}

export class Deployment {
  apiClient: ApiClient
  constructor(manager: Manager) {
    this.apiClient = new ApiClient(manager)
  }

  async deploy({ serverName, assets, project, state }: DeployArgs) {
    const accountName = await this.apiClient.manager.auth.toUserName()
    const token = state.session?.access_token

    invariant(token, 'Token is missing')

    const deployed = await deploySandboxApi({
      accountName,
      serverName,
      assets,
      generatorIds: project.toGeneratorIds(),
      token
    })

    updateProjectKey({ project, projectKey: `@${accountName}/${project.name}` })

    return deployed
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
