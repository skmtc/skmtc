import type { SkmtcStackConfig } from '@skmtc/core/Settings'
import { createSupabaseClient } from '../auth/supabase-client.ts'
import type { DenoFiles } from './types.ts'
import * as v from 'valibot'

export type Plugin = {
  id: string
  src: string
  type: 'operations' | 'models'
  description?: string
}

type DeployArgs = {
  assets: DenoFiles
  stackConfig: SkmtcStackConfig
}

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

export const deploy = async ({ assets, stackConfig }: DeployArgs) => {
  const kv = await Deno.openKv()
  const supabase = createSupabaseClient({ kv })

  const { data: auth } = await supabase.auth.getSession()

  if (!auth?.session) {
    console.log('You are not logged in')

    kv.close()

    return
  }

  const userName = auth.session.user.user_metadata.user_name

  const { data, error } = await supabase.functions.invoke(
    `servers/${userName}/${stackConfig.name}`,
    {
      method: 'POST',
      body: {
        assets,
        generatorIds: stackConfig.generators
      }
    }
  )

  if (error) {
    throw new Error(`Failed to deploy stack: ${error.message}`)
  }

  return v.parse(denoDeployment, data)
}
