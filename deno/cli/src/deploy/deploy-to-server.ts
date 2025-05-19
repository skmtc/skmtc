import type { SkmtcStackConfig } from '@skmtc/core/Settings'
import type { DenoFiles } from './types.ts'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as v from 'valibot'

export type Plugin = {
  id: string
  src: string
  type: 'operations' | 'models'
  description?: string
}

type DeployToServerArgs = {
  assets: DenoFiles
  stackConfig: SkmtcStackConfig
  accountName: string
  supabase: SupabaseClient<any, 'public', any>
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

export const deployToServer = async ({
  supabase,
  accountName,
  assets,
  stackConfig
}: DeployToServerArgs) => {
  const { data, error } = await supabase.functions.invoke(
    `servers/${accountName}/${stackConfig.name}`,
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
