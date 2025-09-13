import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { type SkmtcClientConfig, skmtcClientConfig } from '@skmtc/core'
import * as v from 'valibot'
import type { Manager } from './manager.ts'
import { writeFileSafeDir } from './file.ts'
import type { ProjectKey } from './project.ts'

type CreateArgs = {
  path: string
  basePath: string
}

type ConstructorArgs = {
  path: string
  contents: SkmtcClientConfig | null
}

type OpenArgs = {
  path: string
  manager: Manager
}

type ToPathArgs = {
  projectPath: string | ProjectKey
}

export class ClientJson {
  contents: SkmtcClientConfig | null
  path: string

  private constructor({ path, contents }: ConstructorArgs) {
    this.path = path
    this.contents = contents
  }

  static toPath({ projectPath }: ToPathArgs): string {
    return join(projectPath, '.settings', 'client.json')
  }

  async refresh() {
    try {
      const contents = await Deno.readTextFile(this.path)

      const parsed = v.parse(skmtcClientConfig, JSON.parse(contents))

      this.contents = parsed
    } catch (_error) {
      // Do nothing
    }
  }

  updateContents(contents: Partial<SkmtcClientConfig>) {
    this.contents = { settings: {}, ...this.contents, ...contents }
  }

  static async open({ path, manager }: OpenArgs): Promise<ClientJson> {
    const hasClientJson = await exists(path, { isFile: true })

    if (!hasClientJson) {
      return new ClientJson({ path, contents: null })
    }

    const contents = await Deno.readTextFile(path)

    const parsed = v.parse(skmtcClientConfig, JSON.parse(contents))

    const clientJson = new ClientJson({ path, contents: parsed })

    manager.cleanupActions.push(async () => await clientJson.write())

    return clientJson
  }

  async write() {
    const content = JSON.stringify(this.contents, null, 2)

    await writeFileSafeDir(this.path, content)
  }

  static create({ path, basePath }: CreateArgs) {
    return new ClientJson({
      path,
      contents: { settings: { basePath } }
    })
  }
}
