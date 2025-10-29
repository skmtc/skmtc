import { createArtifactsResponse } from '@/types/createArtifactsResponse.generated.ts'
import type { ClientSettings } from '@/types/clientSettings.generated.ts'

export type GenerateSandboxApiArgs = {
  accountName: string
  serverName: string
  schema: string
  clientSettings: ClientSettings | undefined
  token: string | undefined
}

export const generateSandboxApi = async ({
  accountName,
  serverName,
  schema,
  clientSettings,
  token
}: GenerateSandboxApiArgs) => {
  const sandboxOrigin =
    Deno.env.get('SANDBOX_API_ORIGIN') ?? 'https://skmtc-sandbox.dmitrigrabov.deno.net'

  const sandboxUrl = `${sandboxOrigin}/${accountName}/${serverName}/artifacts`

  const res = await fetch(sandboxUrl, {
    method: 'POST',
    body: JSON.stringify({ schema, clientSettings }),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    console.log('ERROR', await res.text())

    throw new Error('Failed to generate artifacts')
  }

  const data = await res.json()

  return createArtifactsResponse.parse(data)
}
