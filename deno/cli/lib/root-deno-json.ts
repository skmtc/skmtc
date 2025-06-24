import { existsSync } from '@std/fs'
import { toRootPath } from './to-root-path.ts'
import { join } from '@std/path'
import { writeFile } from './file.ts'
import * as v from 'valibot'
import { rootDenoJson, type RootDenoJson as RootDenoJsonType } from '@skmtc/core'
import { Generator } from './generator.ts'
import type { Manager } from './manager.ts'

export class RootDenoJson {
  contents: RootDenoJsonType

  private constructor(contents: RootDenoJsonType) {
    this.contents = contents
  }

  static toPath() {
    const rootPath = toRootPath()

    return join(rootPath, 'deno.json')
  }

  static exists(): boolean {
    const denoJsonPath = RootDenoJson.toPath()

    return existsSync(denoJsonPath)
  }

  static async open(manager: Manager): Promise<RootDenoJson> {
    const hasDenoJson = RootDenoJson.exists()

    if (!hasDenoJson) {
      return new RootDenoJson({})
    }

    const contents = await Deno.readTextFile(RootDenoJson.toPath())

    const parsed = v.parse(rootDenoJson, JSON.parse(contents))
    const denoJson = new RootDenoJson(parsed)

    manager.cleanupActions.push(async () => await denoJson.write())

    return denoJson
  }

  static isLocalModule(packageName: string) {
    const { scheme } = Generator.parseName(packageName)

    return !scheme
  }

  removeGenerator(generator: Generator) {
    const packageName = generator.toPackageName()

    const isLocal = RootDenoJson.isLocalModule(packageName)

    if (isLocal) {
      Deno.remove(join(toRootPath(), '.apifoundry', generator.generatorName))
    }

    if (this.contents.imports) {
      this.contents.imports = Object.fromEntries(
        Object.entries(this.contents.imports).filter(([key]) => key !== packageName)
      )
    }

    if (isLocal && this.contents.workspace) {
      const generatorPath = generator.toPath()

      this.contents.workspace = this.contents.workspace.filter(path => path !== generatorPath)
    }
  }

  addImport(key: string, value: string) {
    this.contents = {
      ...this.contents,
      imports: { ...this.contents.imports, [key]: value }
    }
  }

  addWorkspace(path: string) {
    this.contents = {
      ...this.contents,
      workspace: [...(this.contents.workspace ?? []), path]
    }
  }

  async write() {
    await writeFile({
      content: JSON.stringify(this.contents),
      resolvedPath: RootDenoJson.toPath()
    })
  }
}
