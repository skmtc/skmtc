import type { DenoFile } from '../deploy/types.ts'
import * as v from 'valibot'
import type { ClientJson } from './client-json.ts'
import { ApiClient } from './api-client.ts'
import { match } from 'ts-pattern'
import type { Manager } from './manager.ts'

type DeployArgs = {
  projectName: string
  generatorIds: string[]
  assets: Record<string, DenoFile>
  clientJson: ClientJson
}

export class Deployment {
  apiClient: ApiClient

  constructor(manager: Manager) {
    this.apiClient = new ApiClient(manager)
  }

  async deploy({ assets, projectName, generatorIds, clientJson }: DeployArgs) {
    const { latestDenoDeploymentId } = await this.apiClient.deploy({
      assets,
      stackName: projectName,
      generatorIds
    })

    await this.enqueueDeploymentCheck(latestDenoDeploymentId)

    return new Promise((resolve, reject) => {
      this.apiClient.manager.kv.listenQueue(async message => {
        if (v.is(checkDeploymentMessage, message)) {
          const [, denoDeploymentId] = message

          const deployment = await this.apiClient.getDeploymentInfo(denoDeploymentId)

          match(deployment.status)
            .with('pending', () => {
              console.log('Deployment pending...')
              this.enqueueDeploymentCheck(denoDeploymentId)
            })
            .with('success', () => {
              clientJson.setDeploymentId(denoDeploymentId)
              resolve(undefined)
            })
            .with('failed', () => {
              reject('Deployment failed')
            })
            .exhaustive()
        }
      })
    })
  }

  async enqueueDeploymentCheck(denoDeploymentId: string) {
    const message = {
      type: 'check-deployment',
      denoDeploymentId
    }

    await this.apiClient.manager.kv.enqueue(['deployments', denoDeploymentId, message], {
      delay: 8000
    })
  }
}

const checkDeployment = v.object({
  type: v.literal('check-deployment'),
  denoDeploymentId: v.string()
})

const checkDeploymentMessage = v.tuple([v.literal('deployments'), v.string(), checkDeployment])
