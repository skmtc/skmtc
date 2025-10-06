import type { DenoFile } from '@/types/denoFile.generated.ts'

export type DeploySandboxApiArgs = {
  accountName: string
  serverName: string
  assets: Record<string, DenoFile>
  generatorIds: string[]
  token: string
}

export const deploySandboxApi = async ({
  accountName,
  serverName,
  assets,
  generatorIds,
  token
}: DeploySandboxApiArgs): Promise<boolean> => {
  const sandboxUrl = `${Deno.env.get('SANDBOX_API_ORIGIN')}/${accountName}/${serverName}`

  const res = await fetch(sandboxUrl, {
    method: 'PUT',
    body: JSON.stringify({ assets, generatorIds }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    console.log('ERROR', await res.text())
  }

  return res.ok
}
