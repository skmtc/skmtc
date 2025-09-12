import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { writeFileSafeDir } from './file.ts'
import * as v from 'valibot'
import { prettierConfigType, type PrettierConfigType } from '@skmtc/core'
import { toProjectPath } from './to-project-path.ts'

type ConstructorArgs = {
  path: string
  contents: PrettierConfigType
}

export class PrettierJson {
  path: string
  contents: PrettierConfigType

  private constructor({ path, contents }: ConstructorArgs) {
    this.path = path
    this.contents = contents
  }

  static toPath(projectName: string) {
    const projectPath = toProjectPath(projectName)

    return join(projectPath, '.prettierrc.json')
  }

  static async exists(path: string): Promise<boolean> {
    return await exists(path, { isFile: true })
  }

  static async openFromPath(path: string): Promise<PrettierJson | null> {
    const hasPrettierJson = await PrettierJson.exists(path)

    if (!hasPrettierJson) {
      return null
    }

    const prettierJson = await Deno.readTextFile(path)

    const contents = v.parse(prettierConfigType, JSON.parse(prettierJson))

    return new PrettierJson({ path, contents })
  }

  async write() {
    await writeFileSafeDir(this.path, JSON.stringify(this.contents, null, 2))
  }

  async refresh() {
    const hasPrettierJson = await PrettierJson.exists(this.path)

    if (!hasPrettierJson) {
      return null
    }

    const contents = await Deno.readTextFile(this.path)

    const parsed = v.parse(prettierConfigType, JSON.parse(contents))

    this.contents = parsed
  }

  static create({ path }: ConstructorArgs) {
    return new PrettierJson({
      path,
      contents: {
        tabWidth: 2,
        useTabs: false,
        semi: false,
        singleQuote: true,
        bracketSpacing: true
      }
    })
  }
}
