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
    const accountName = await this.apiClient.manager.auth.toUserName()

    const { latestDenoDeploymentId } = await this.apiClient.deploy({
      assets,
      accountName,
      stackName: projectName,
      generatorIds
    })

    await this.enqueueDeploymentCheck(latestDenoDeploymentId)

    this.apiClient.manager.kv.listenQueue(async message => {
      if (v.is(checkDeploymentSchema, message)) {
        if (message.denoDeploymentId !== latestDenoDeploymentId) {
          return
        }

        const deployment = await this.apiClient.getDeploymentInfo(message.denoDeploymentId)

        match(deployment.status)
          .with('pending', () => {
            console.log('Deployment pending...')
            this.enqueueDeploymentCheck(message.denoDeploymentId)
          })
          .with('success', () => {
            clientJson.setDeploymentId(message.denoDeploymentId)
            console.log('Deployment successful')
          })
          .with('failed', () => {
            throw new Error('Deployment failed')
          })
          .exhaustive()
      }
    })
  }

  async enqueueDeploymentCheck(denoDeploymentId: string) {
    const message = {
      type: 'check-deployment',
      denoDeploymentId
    }

    await this.apiClient.manager.kv.enqueue(message, { delay: 8000 })
  }
}

const checkDeploymentSchema = v.object({
  type: v.literal('check-deployment'),
  denoDeploymentId: v.string()
})
