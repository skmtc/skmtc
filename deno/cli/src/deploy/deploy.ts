import { Command } from '@cliffy/command'
import { resolve } from '@std/path'
import { toAssets } from './to-assets.ts'
import { deployToServer } from './deploy-to-server.ts'
import { Input } from '@cliffy/prompt'
import * as v from 'valibot'
import { getDeploymentInfo } from './get-deployment-info.ts'
import { existsSync } from '@std/fs'
import { createSupabaseClient } from '../auth/supabase-client.ts'

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
  const kv = await Deno.openKv()

  const supabase = createSupabaseClient({ kv })

  const { data: auth } = await supabase.auth.getSession()

  if (!auth?.session) {
    console.log('You are not logged in')

    kv.close()

    return
  }

  const accountName = auth.session.user.user_metadata.user_name

  const skmtcRoot = resolve(path, '.codesquared')

  const stackConfig = Deno.readTextFileSync(resolve(skmtcRoot, '.settings', 'stack.json'))

  const assets = await toAssets({ skmtcRoot })

  try {
    const res = await deployToServer({
      supabase,
      accountName,
      assets,
      stackConfig: JSON.parse(stackConfig)
    })

    console.log('Generators stack uploaded. Checking deployment...')

    if (!res) {
      console.error('Deployment failed')

      return
    }

    await enqueueDeploymentCheck({ kv, denoDeploymentId: res.latestDenoDeploymentId })

    kv.listenQueue(async message => {
      if (v.is(checkDeploymentSchema, message)) {
        if (message.denoDeploymentId !== res.latestDenoDeploymentId) {
          return
        }

        const deployment = await getDeploymentInfo({ deploymentId: message.denoDeploymentId })

        if (deployment.status === 'pending') {
          console.log('Deployment pending...')
          enqueueDeploymentCheck({ kv, denoDeploymentId: message.denoDeploymentId })
        }

        if (deployment.status === 'success') {
          updateClientJson({
            homePath: skmtcRoot,
            denoDeploymentId: message.denoDeploymentId,
            accountName
          })

          console.log('Deployment successful')

          kv.close()
          Deno.exit(0)
        }

        if (deployment.status === 'failed') {
          console.error('Deployment failed')
          kv.close()
          Deno.exit(1)
        }
      }
    })
  } catch (error) {
    console.error('Deployment failed', error)
  }
}

type UpdateClientJsonArgs = {
  homePath: string
  denoDeploymentId: string
  accountName: string
}

const updateClientJson = async ({
  homePath,
  denoDeploymentId,
  accountName
}: UpdateClientJsonArgs) => {
  const clientJsonPath = resolve(homePath, '.codesquared', '.settings', 'client.json')

  if (existsSync(clientJsonPath)) {
    const clientJson = await Deno.readTextFile(clientJsonPath)

    const clientJsonObject = JSON.parse(clientJson)

    clientJsonObject.deploymentId = denoDeploymentId

    await Deno.writeTextFile(clientJsonPath, JSON.stringify(clientJsonObject, null, 2))
  } else {
    const clientJson = {
      accountName,
      deploymentId: denoDeploymentId,
      settings: {
        generators: []
      }
    }

    await Deno.writeTextFile(clientJsonPath, JSON.stringify(clientJson, null, 2))
  }
}

type EnqueueDeploymentCheckArgs = {
  kv: Deno.Kv
  denoDeploymentId: string
}

const enqueueDeploymentCheck = async ({ kv, denoDeploymentId }: EnqueueDeploymentCheckArgs) => {
  await kv.enqueue(
    {
      type: 'check-deployment',
      denoDeploymentId
    },
    { delay: 8000 }
  )
}

const checkDeploymentSchema = v.object({
  type: v.literal('check-deployment'),
  denoDeploymentId: v.string()
})
