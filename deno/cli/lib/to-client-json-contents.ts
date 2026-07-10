import { join } from '@std/path/join'
import { skmtcClientConfig } from '@skmtc/core/Settings'
import { expandClientJson } from '@skmtc/core/ClientJsonCompact'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'

export const toClientJsonContents = (projectPath: string) => {
  try {
    const clientJsonPath = join(projectPath, '.settings', 'client.json')
    const clientJsonString = Deno.readTextFileSync(clientJsonPath)

    const clientJson = expandClientJson(JSON.parse(clientJsonString))

    return parseOrExplain(skmtcClientConfig, clientJson, `client.json at ${clientJsonPath}`)
  } catch (_error) {
    return undefined
  }
}
