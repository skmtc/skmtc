import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { writeFileSafeDir } from './file.ts'
import * as v from 'valibot'
import { prettierConfigType, type PrettierConfigType } from '@skmtc/core'
import { toProjectPath } from './to-project-path.ts'

type ConstructorArgs = {
  projectName: string
  contents: PrettierConfigType
}

export class PrettierJson {
  projectName: string
  contents: PrettierConfigType

  private constructor({ projectName, contents }: ConstructorArgs) {
    this.projectName = projectName
    this.contents = contents
  }

  static toPath(projectName: string) {
    const projectPath = toProjectPath(projectName)

    return join(projectPath, '.prettierrc.json')
  }

  static async exists(projectName: string): Promise<boolean> {
    const prettierJsonPath = PrettierJson.toPath(projectName)

    return await exists(prettierJsonPath, { isFile: true })
  }

  static async open(projectName: string): Promise<PrettierJson | null> {
    const hasPrettierJson = await PrettierJson.exists(projectName)

    if (!hasPrettierJson) {
      return null
    }

    const prettierJson = await Deno.readTextFile(PrettierJson.toPath(projectName))

    const contents = v.parse(prettierConfigType, JSON.parse(prettierJson))

    return new PrettierJson({ projectName, contents })
  }

  async write() {
    const resolvedPath = PrettierJson.toPath(this.projectName)

    await writeFileSafeDir(resolvedPath, JSON.stringify(this.contents, null, 2))
  }

  async refresh() {
    const hasPrettierJson = await PrettierJson.exists(this.projectName)

    if (!hasPrettierJson) {
      return null
    }

    const contents = await Deno.readTextFile(PrettierJson.toPath(this.projectName))

    const parsed = v.parse(prettierConfigType, JSON.parse(contents))

    this.contents = parsed
  }

  static create({ projectName }: ConstructorArgs) {
    return new PrettierJson({
      projectName,
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
