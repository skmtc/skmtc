import type { ClientSettings } from '@skmtc/core/Settings'
import type { ManifestContent } from '@skmtc/core/Manifest'
import type { GenerationMapEntry, Sidecar } from '@skmtc/core/Anchors'
import { type FileType, fileTypeToProtocol } from '@/lib/types.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'
import { resolveHubToken } from '@/lib/hub-token.ts'

type GenerateWithServerArgs = {
  /**
   * Base URL of a DEPLOYED stack server, e.g.
   * `https://api.skmtc.net/v1/stacks/acme/react-stack/servers/3.0.1`. The
   * generate request is POSTed to `{stackUrl}/artifacts`.
   */
  stackUrl: string
  schemaContents: string
  fileType: FileType
  clientSettings: ClientSettings | undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Generate against a DEPLOYED stack server instead of loading the local
 * `bundle.js`. POSTs the raw schema + settings to `{stackUrl}/artifacts` — the
 * `@skmtc/server` contract, which runs the Swagger 2 / OAS 3.1 → 3.0 conversion
 * itself — and returns the same {@link GenerateResponse} shape the local worker
 * produces, so `writeGeneratedFiles` (stale cleanup + byte-identical dedup +
 * manifest write) needs no changes.
 *
 * Attaches the hub PAT when available (`$SKMTC_HUB_TOKEN` → `~/.skmtc/auth.json`)
 * for private stacks; public stacks generate anonymously.
 */
export const generateWithServer = async ({
  stackUrl,
  schemaContents,
  fileType,
  clientSettings
}: GenerateWithServerArgs): Promise<GenerateResponse> => {
  const endpoint = `${stackUrl.replace(/\/+$/, '')}/artifacts`
  const protocol = fileTypeToProtocol(fileType)

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = resolveHubToken()
  if (token) headers.authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ protocol, schema: schemaContents, clientSettings })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to reach stack server at ${endpoint}: ${message}`)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Stack server ${endpoint} responded ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ''}`
    )
  }

  const body: unknown = await response.json()
  if (!isRecord(body) || !isRecord(body.artifacts) || !isRecord(body.manifest)) {
    throw new Error(`Stack server ${endpoint} returned an unexpected response shape`)
  }

  // The JSON boundary is untyped; the server is the `@skmtc/server` contract,
  // which returns exactly a `GenerateResponse`. Narrowed above; cast the leaves.
  return {
    artifacts: body.artifacts as Record<string, string>,
    manifest: body.manifest as ManifestContent,
    sidecars: body.sidecars as Record<string, Sidecar> | undefined,
    generationMap: body.generationMap as GenerationMapEntry[] | undefined
  }
}
