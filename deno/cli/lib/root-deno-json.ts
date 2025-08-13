import { existsSync } from '@std/fs'
import { join } from '@std/path'
import { writeFileSafeDir } from './file.ts'
import * as v from 'valibot'
import { rootDenoJson, type RootDenoJson as RootDenoJsonType } from '@skmtc/core'
import { Generator } from './generator.ts'
import type { Manager } from './manager.ts'
import { toProjectPath } from './to-project-path.ts'
import invariant from 'tiny-invariant'

type ConstructorArgs = {
  projectName: string
  contents: RootDenoJsonType
}

export class RootDenoJson {
  projectName: string
  contents: RootDenoJsonType

  private constructor({ projectName, contents }: ConstructorArgs) {
    this.projectName = projectName
    this.contents = contents
  }

  static toPath(projectName: string) {
    const projectPath = toProjectPath(projectName)

    return join(projectPath, 'deno.json')
  }

  static exists(projectName: string): boolean {
    const denoJsonPath = RootDenoJson.toPath(projectName)

    return existsSync(denoJsonPath)
  }

  static create(projectName: string) {
    return new RootDenoJson({ projectName, contents: {} })
  }

  toGeneratorIds() {
    return Object.keys(this.contents.imports ?? {}).filter(item => {
      return Generator.parseName(item).generatorName.startsWith('gen-')
    })
  }

  static async open(projectName: string, manager: Manager): Promise<RootDenoJson> {
    const hasDenoJson = RootDenoJson.exists(projectName)

    if (!hasDenoJson) {
      return new RootDenoJson({ projectName, contents: {} })
    }

    const contents = await Deno.readTextFile(RootDenoJson.toPath(projectName))

    const parsed = v.parse(rootDenoJson, JSON.parse(contents))
    const denoJson = new RootDenoJson({ projectName, contents: parsed })

    manager.cleanupActions.push(async () => await denoJson.write())

    return denoJson
  }

  static isLocalModule(packageName: string) {
    const { scheme } = Generator.parseName(packageName)

    return !scheme
  }

  removeGenerator(generator: Generator) {
    const packageName = generator.toPackageName()

    const packageSource = this.contents.imports?.[packageName]

    invariant(packageSource, 'Package source not found')

    const isLocal = RootDenoJson.isLocalModule(packageSource)

    if (isLocal) {
      Deno.remove(join(toProjectPath(this.projectName), generator.generatorName))
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
    const path = RootDenoJson.toPath(this.projectName)
    const content = JSON.stringify(this.contents, null, 2)

    await writeFileSafeDir(path, content)
  }
}
