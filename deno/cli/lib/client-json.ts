import { ensureDir, exists } from '@std/fs'
import { join } from '@std/path'
import { toRootPath } from './to-root-path.ts'
import { type SkmtcClientConfig, skmtcClientConfig } from '@skmtc/core'
import * as v from 'valibot'
import type { Manager } from './manager.ts'

export class ClientJson {
  contents: SkmtcClientConfig

  private constructor(contents: SkmtcClientConfig) {
    this.contents = contents
  }

  static toPath() {
    const rootPath = toRootPath()

    return join(rootPath, '.settings', 'client.json')
  }

  static async exists(): Promise<boolean> {
    const path = ClientJson.toPath()

    return await exists(path, { isFile: true })
  }

  static async open(manager: Manager): Promise<ClientJson> {
    const hasClientJson = await ClientJson.exists()

    if (!hasClientJson) {
      throw new Error('Client JSON not found')
    }

    const contents = await Deno.readTextFile(this.toPath())

    const parsed = v.parse(skmtcClientConfig, JSON.parse(contents))
    const clientJson = new ClientJson(parsed)

    manager.cleanupActions.push(async () => await clientJson.write())

    return clientJson
  }

  setDeploymentId(deploymentId: string) {
    this.contents.deploymentId = deploymentId
  }

  async write() {
    const settingsPath = join(toRootPath(), '.settings')

    await ensureDir(settingsPath)

    const clientJsonPath = ClientJson.toPath()

    await Deno.writeTextFile(clientJsonPath, JSON.stringify(this.contents, null, 2))
  }

  static create(accountName: string) {
    return new ClientJson({ accountName, settings: { enrichments: {} } })
  }
}
