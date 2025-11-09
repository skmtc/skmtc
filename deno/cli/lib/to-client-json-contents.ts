import { join } from '@std/path/join'
import { skmtcClientConfig } from '@skmtc/core/Settings'
import * as v from 'valibot'

export const toClientJsonContents = (projectPath: string) => {
  try {
    const clientJsonPath = join(projectPath, '.settings', 'client.json')
    const clientJsonString = Deno.readTextFileSync(clientJsonPath)

    const clientJson = JSON.parse(clientJsonString)

    return v.parse(skmtcClientConfig, clientJson)
  } catch (error) {
    console.error(error)
    return undefined
  }
}
