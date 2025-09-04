import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { toProjectPath } from './to-project-path.ts'
import { type SkmtcClientConfig, skmtcClientConfig } from '@skmtc/core'
import * as v from 'valibot'
import type { Manager } from './manager.ts'
import { writeFileSafeDir } from './file.ts'

type CreateArgs = {
  projectName: string
  basePath: string
}

type ConstructorArgs = {
  projectName: string
  contents: SkmtcClientConfig
}

type ServerInfo = {
  serverName: string
  deploymentId?: string
}

export class ClientJson {
  contents: SkmtcClientConfig
  projectName: string

  private constructor({ projectName, contents }: ConstructorArgs) {
    this.projectName = projectName
    this.contents = contents
  }

  static toPath(projectName: string) {
    const projectPath = toProjectPath(projectName)

    return join(projectPath, '.settings', 'client.json')
  }

  static async exists(projectName: string): Promise<boolean> {
    const path = ClientJson.toPath(projectName)

    return await exists(path, { isFile: true })
  }

  async refresh() {
    const contents = await Deno.readTextFile(ClientJson.toPath(this.projectName))

    const parsed = v.parse(skmtcClientConfig, JSON.parse(contents))

    this.contents = parsed
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

  setServerInfo({ serverName, deploymentId }: ServerInfo) {
    this.contents.serverName = serverName

    if (deploymentId) {
      this.contents.deploymentId = deploymentId
      this.contents.serverOrigin = `https://${serverName}-${deploymentId}.deno.dev`
    }
  }

  async write() {
    const path = ClientJson.toPath(this.projectName)
    const content = JSON.stringify(this.contents, null, 2)

    await writeFileSafeDir(path, content)
  }

  static create({ projectName, basePath }: CreateArgs) {
    return new ClientJson({
      projectName,
      contents: { settings: { basePath } }
    })
  }
}
