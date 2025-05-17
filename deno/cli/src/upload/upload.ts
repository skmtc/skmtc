import { Command } from '@cliffy/command'
import { resolve } from '@std/path'
import { toAssets } from './to-assets.ts'
import { deploy } from './deploy.ts'

export const toUploadCommand = () => {
  return new Command()
    .description('Upload a file to Codesquared')
    .arguments('[path]')
    .action(async (_, path = './') => {
      const skmtcRoot = resolve(path, '.codesquared')

      const stackConfig = Deno.readTextFileSync(resolve(skmtcRoot, '.settings', 'stack.json'))

      const assets = await toAssets({ skmtcRoot })

      try {
        const res = await deploy({
          assets,
          stackConfig: JSON.parse(stackConfig)
        })

        console.log('Deployment successful', res)
      } catch (error) {
        console.error('Deployment failed', error)
      }
    })
}

export const toUploadPrompt = async () => {
  console.log('Uploading file', Deno.cwd())
}
