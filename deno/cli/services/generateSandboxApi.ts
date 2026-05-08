import * as v from 'valibot'
import { createArtifactsResponse } from '@/types/createArtifactsResponse.generated.ts'
import type { ClientSettings } from '@skmtc/core/Settings'
import type { GenerateResponse } from '@/lib/generate-worker.ts'
import type { Protocol } from '@/lib/types.ts'

export type GenerateSandboxApiArgs = {
  accountName: string
  serverName: string
  schema: string
  /**
   * Source-document protocol. Determines which parser the sandbox
   * server runs over `schema`. The server requires this field to be
   * present (it's the discriminator on the request body's union
   * schema), so the CLI always sends a value here.
   */
  protocol: Protocol
  clientSettings: ClientSettings | undefined
  token: string | undefined
}

export const generateSandboxApi = async ({
  accountName,
  serverName,
  schema,
  protocol,
  clientSettings,
  token
}: GenerateSandboxApiArgs): Promise<GenerateResponse> => {
  const sandboxOrigin =
    Deno.env.get('SANDBOX_API_ORIGIN') ?? 'https://skmtc-sandbox.dmitrigrabov.deno.net'

  const sandboxUrl = `${sandboxOrigin}/${accountName}/${serverName}/artifacts`

  const res = await fetch(sandboxUrl, {
    method: 'POST',
    body: JSON.stringify({ schema, protocol, clientSettings }),
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

  return v.parse(createArtifactsResponse, data)
}
