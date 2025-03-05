import { SkmtcStackConfig } from '@skmtc/core/Settings'
import { getSession } from '../auth/getSession'
import { DenoFiles } from '../types/File'
import { SKMTC_API } from './constants'
import { z } from 'zod'

export type Plugin = {
  id: string
  src: string
  type: 'operations' | 'models'
  description?: string
}

type CreateDeploymentArgs = {
  assets: DenoFiles
  stackConfig: SkmtcStackConfig
  stackName: string
}

const denoDeployment = z.object({
  id: z.string(),
  stackName: z.string(),
  projectId: z.string(),
  latestStatus: z.enum(['pending', 'success', 'failed']),
  latestDeploymentId: z.string(),
  latestDenoDeploymentId: z.string(),
  accountName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const createDeployment = async ({
  assets,
  stackConfig,
  stackName
}: CreateDeploymentArgs) => {
  const session = await getSession({ createIfNone: true })

  if (!session) {
    return
  }

  const url = `${SKMTC_API}/servers/${session.account.label}/${stackName}`

  console.log('URL', url)

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      assets,
      generatorIds: stackConfig.generators
    }),
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: `Bearer ${session.accessToken}`
    }
  })

  if (!res.ok) {
    const content = await res.text()

    throw new Error(`Failed to deploy stack: ${content}`)
  }

  const body = await res.json()

  console.log('BODY', body)

  return denoDeployment.parse(body)
}
