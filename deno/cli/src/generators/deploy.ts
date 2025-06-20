import { Command } from '@cliffy/command'
import { toAssets } from '../deploy/to-assets.ts'
import { StackJson } from '../lib/stack-json.ts'
import { toRootPath } from '../lib/to-root-path.ts'
import { ClientJson } from '../lib/client-json.ts'
import { Deployment } from '../lib/deployment.ts'
import { Manager } from '../lib/manager.ts'

export const description = 'Deploy generators to API Foundry'

export const toDeployCommand = () => {
  return new Command().description(description).action(async _ => await deploy())
}

export const toDeployPrompt = async () => {
  await deploy()
}

export const deploy = async () => {
  const manager = new Manager(await Deno.openKv())

  const deployment = new Deployment(manager)

  const stackJson = await StackJson.open()
  const clientJson = await ClientJson.open()
  const assets = await toAssets({ skmtcRoot: toRootPath() })

  try {
    await deployment.deploy({ assets, stackJson, clientJson })
  } catch (error) {
    console.error('Deployment failed', error)
  } finally {
    await stackJson.write()
    await clientJson.write()

    kv.close()
  }
}
