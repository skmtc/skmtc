import { Command } from '@cliffy/command'
import { resolve } from '@std/path'
import { toAssets } from './to-assets.ts'
import { deployToServer } from './deploy-to-server.ts'
import { Input } from '@cliffy/prompt'
import { getDeployment } from './get-deployment.ts'

export const toDeployCommand = () => {
  return new Command()
    .description('Deploy a stack to Codesquared')
    .arguments('[path]')
    .action(async (_, path = './') => await deploy(path))
}

export const toDeployPrompt = async () => {
  const path = await Input.prompt({
    message: 'Enter path to .codesquared folder'
  })

  await deploy(path)
}

export const deploy = async (path: string) => {
  const skmtcRoot = resolve(path, '.codesquared')

  const stackConfig = Deno.readTextFileSync(resolve(skmtcRoot, '.settings', 'stack.json'))

  const assets = await toAssets({ skmtcRoot })

  try {
    const res = await deployToServer({
      assets,
      stackConfig: JSON.parse(stackConfig)
    })

    if (!res) {
      console.error('Deployment failed')

      return
    }
  } catch (error) {
    console.error('Deployment failed', error)
  }
}

const checkDeployment = async (res: any) => {
  if (res.status === 200) {
    console.log('Deployment successful', res)
  } else {
    console.error('Deployment failed', res)
  }
}
