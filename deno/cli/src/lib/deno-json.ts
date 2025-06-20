import { exists } from '@std/fs'
import { toRootPath } from './to-root-path.ts'
import { join } from '@std/path'
import { writeFile } from './file.ts'
import * as v from 'valibot'
import { rootDenoJson, type RootDenoJson } from '@skmtc/core'
import { Generator } from './generator.ts'

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

  static async open(): Promise<DenoJson> {
    const hasDenoJson = await DenoJson.exists()

    if (!hasDenoJson) {
      return new DenoJson({})
    }

    const denoJson = await Deno.readTextFile(DenoJson.toPath())

    const contents = v.parse(rootDenoJson, JSON.parse(denoJson))

    return new DenoJson(contents)
  }

  isLocalModule(packageName: string) {
    const { scheme } = Generator.parseName(packageName)

    return !scheme
  }

  removeGenerator(generator: Generator) {
    const packageName = generator.toPackageName()

    const isLocal = this.isLocalModule(packageName)

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
      resolvedPath: DenoJson.toPath()
    })
  }
}
