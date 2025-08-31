import { exists } from '@std/fs/exists'
import { writeFileSafeDir } from './file.ts'
import * as v from 'valibot'
import { packageDenoJson, type PackageDenoJson as PackageDenoJsonType } from '@skmtc/core'
import type { Manager } from './manager.ts'

type PackageDenoJsonArgs = {
  path: string
  contents: PackageDenoJsonType
}

type CreateArgs = {
  path: string
  contents: PackageDenoJsonType
}

export class PackageDenoJson {
  contents: PackageDenoJsonType
  path: string

  private constructor({ path, contents }: PackageDenoJsonArgs) {
    this.contents = contents
    this.path = path
  }

  static async exists(path: string): Promise<boolean> {
    return await exists(path, { isFile: true })
  }

  static async open(path: string, manager: Manager): Promise<PackageDenoJson> {
    const hasDenoJson = await PackageDenoJson.exists(path)

    if (!hasDenoJson) {
      throw new Error(`Package deno.json not found at "${path}"`)
    }

    const contents = await Deno.readTextFile(path)

    const parsed = v.parse(packageDenoJson, JSON.parse(contents))
    const denoJson = new PackageDenoJson({ path, contents: parsed })

    manager.cleanupActions.push(async () => await denoJson.write())

    return denoJson
  }

  static create({ path, contents }: CreateArgs, manager: Manager) {
    const denoJson = new PackageDenoJson({ path, contents })

    manager.cleanupActions.push(async () => await denoJson.write())

    return denoJson
  }

  async write() {
    const content = JSON.stringify(this.contents, null, 2)

    await writeFileSafeDir(this.path, content)
  }
}
