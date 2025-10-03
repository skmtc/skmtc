import { createArtifactsResponse } from '@/types/createArtifactsResponse.generated.ts'
import type { DenoFile } from '@/types/denoFile.generated.ts'

export type GenerateSandboxApiArgs = {
  schema: string
  generatorIds: string[]
  assets: Record<string, DenoFile>
}

export const generateSandboxApi = async ({
  schema,
  generatorIds,
  assets
}: GenerateSandboxApiArgs) => {
  console.log('GENERATING SANDBOX API')
  console.log('SCHEMA', schema.slice(0, 100))
  console.log('GENERATOR IDS', generatorIds)
  console.log('ASSETS', assets)

  const res = await fetch(`https://skmtc-sandbox.dmitrigrabov.deno.net/artifacts`, {
    method: 'POST',
    body: JSON.stringify({ schema, generatorIds, assets })
  })

  if (!res.ok) {
    console.log('ERROR', await res.text())

    return null
  }

  const data = await res.json()

  return createArtifactsResponse.parse(data)
}
