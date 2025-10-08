import { createArtifactsResponse } from '@/types/createArtifactsResponse.generated.ts'
import type { ClientSettings } from '@/types/clientSettings.generated.ts'
import type { PrettierConfigType } from '@/types/prettierConfigType.generated.ts'

export type GenerateSandboxApiArgs = {
  accountName: string
  serverName: string
  schema: string
  clientSettings: ClientSettings | undefined
  prettier: PrettierConfigType | undefined
  token: string | undefined
}

export const generateSandboxApi = async ({
  accountName,
  serverName,
  schema,
  clientSettings,
  prettier,
  token
}: GenerateSandboxApiArgs) => {
  const sandboxUrl = `${Deno.env.get('SANDBOX_API_ORIGIN')}/${accountName}/${serverName}/artifacts`

  const res = await fetch(sandboxUrl, {
    method: 'POST',
    body: JSON.stringify({ schema, clientSettings, prettier }),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    console.log('ERROR', await res.text())

    return null
  }

  const data = await res.json()

  return createArtifactsResponse.parse(data)
}
