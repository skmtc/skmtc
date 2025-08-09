import { ensureDir, exists } from '@std/fs'
import { join } from '@std/path'
import { toRootPath } from './to-root-path.ts'
import { toProjectPath } from './to-project-path.ts'
import { type SkmtcClientConfig, skmtcClientConfig } from '@skmtc/core'
import * as v from 'valibot'
import type { Manager } from './manager.ts'

type CreateArgs = {
  accountName: string
  projectName: string
  basePath: string
}

type ConstructorArgs = {
  projectName: string
  contents: SkmtcClientConfig
}

export class ClientJson {
  contents: SkmtcClientConfig
  projectName: string

  private constructor({ projectName, contents }: ConstructorArgs) {
    this.projectName = projectName
    this.contents = contents
  }

  static toPath(projectName: string) {
    const rootPath = toProjectPath(projectName)

    return join(rootPath, '.settings', 'client.json')
  }

  static async exists(projectName: string): Promise<boolean> {
    const path = ClientJson.toPath(projectName)

    return await exists(path, { isFile: true })
  }

  static async open(projectName: string, manager: Manager): Promise<ClientJson> {
    const hasClientJson = await ClientJson.exists(projectName)

    if (!hasClientJson) {
      throw new Error('Client JSON not found')
    }

    const contents = await Deno.readTextFile(ClientJson.toPath(projectName))

    const parsed = v.parse(skmtcClientConfig, JSON.parse(contents))
    const clientJson = new ClientJson({ projectName, contents: parsed })

    manager.cleanupActions.push(async () => await clientJson.write())

    return clientJson
  }

  setDeploymentId(deploymentId: string) {
    this.contents.deploymentId = deploymentId
  }

  async write() {
    const settingsPath = join(toRootPath(), '.settings')

    await ensureDir(settingsPath)

    const clientJsonPath = ClientJson.toPath(this.projectName)

    await Deno.writeTextFile(clientJsonPath, JSON.stringify(this.contents, null, 2))
  }

  static create({ accountName, projectName, basePath }: CreateArgs) {
    return new ClientJson({
      projectName,
      contents: { accountName, settings: { basePath, enrichments: {} } }
    })
  }
}
