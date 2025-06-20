import type { DenoFile } from '../deploy/types.ts'
import type { Manager } from './manager.ts'
import * as v from 'valibot'

const denoDeployment = v.object({
  id: v.string(),
  stackName: v.string(),
  projectId: v.string(),
  latestStatus: v.picklist(['pending', 'success', 'failed']),
  latestDeploymentId: v.string(),
  latestDenoDeploymentId: v.string(),
  accountName: v.string(),
  createdAt: v.string(),
  updatedAt: v.string()
})

const deploymentInfo = v.object({
  status: v.picklist(['pending', 'success', 'failed'])
})

type DeployArgs = {
  assets: Record<string, DenoFile>
  accountName: string
  stackName: string
  generatorIds: string[]
}

export class ApiClient {
  manager: Manager

  constructor(manager: Manager) {
    this.manager = manager
  }

  async deploy({ assets, accountName, stackName, generatorIds }: DeployArgs) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `servers/${accountName}/${stackName}`,
      {
        method: 'POST',
        body: {
          assets,
          generatorIds
        }
      }
    )

    if (error) {
      throw new Error(`Failed to deploy stack`)
    }

    return v.parse(denoDeployment, data)
  }

  async getDeploymentInfo(deploymentId: string) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `/deployments/${deploymentId}/info`,
      {
        method: 'GET'
      }
    )

    if (error) {
      throw new Error(`Failed to deploy stack`)
    }

    return v.parse(deploymentInfo, data)
  }
}
