import { Command } from '@cliffy/command'
import { resolve } from '@std/path'
import { toAssets } from './to-assets.ts'
import { deploy } from './deploy.ts'
import { Input } from '@cliffy/prompt'
import { getDeployment } from './get-deployment.ts'

export const toUploadCommand = () => {
  return new Command()
    .description('Upload a file to Codesquared')
    .arguments('[path]')
    .action(async (_, path = './') => await upload(path))
}

export const toUploadPrompt = async () => {
  const path = await Input.prompt({
    message: 'Enter path to .codesquared folder'
  })

  await upload(path)
}

export const upload = async (path: string) => {
  const skmtcRoot = resolve(path, '.codesquared')

  const stackConfig = Deno.readTextFileSync(resolve(skmtcRoot, '.settings', 'stack.json'))

  const assets = await toAssets({ skmtcRoot })

  try {
    const res = await deploy({
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
