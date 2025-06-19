import { exists } from '@std/fs'
import { toRootPath } from './to-root-path.ts'
import { join } from '@std/path'
import { writeFile } from './file.ts'
import * as v from 'valibot'
import { rootDenoJson, type RootDenoJson } from '@skmtc/core'
import type { Generator } from './generator.ts'

export class DenoJson {
  contents: RootDenoJson

  private constructor(contents: RootDenoJson) {
    this.contents = contents
  }

  static toPath() {
    const rootPath = toRootPath()

    return join(rootPath, 'deno.json')
  }

  static async exists(): Promise<boolean> {
    const denoJsonPath = DenoJson.toPath()

    return await exists(denoJsonPath, { isFile: true })
  }

  static async open(): Promise<DenoJson | null> {
    const hasDenoJson = await DenoJson.exists()

    if (!hasDenoJson) {
      return new DenoJson({})
    }

    const denoJson = await Deno.readTextFile(DenoJson.toPath())

    const contents = v.parse(rootDenoJson, JSON.parse(denoJson))

    return new DenoJson(contents)
  }

  async write() {
    await writeFile({
      content: JSON.stringify(this.contents),
      resolvedPath: DenoJson.toPath()
    })
  }

  async addGenerator(generator: Generator) {
    this.contents = generator.addToDenoJson(this.contents)

    await this.write()
  }
}
