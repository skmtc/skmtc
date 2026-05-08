import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { writeFileSafeDir } from '@/lib/file.ts'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'
import { prettierConfigType, type PrettierConfigType } from '@skmtc/core/PrettierConfig'
import { toProjectPath } from '@/lib/to-project-path.ts'

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

    const contents = parseOrExplain(
      prettierConfigType,
      JSON.parse(prettierJson),
      `.prettierrc.json at ${path}`
    )

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

    const parsed = parseOrExplain(
      prettierConfigType,
      JSON.parse(contents),
      `.prettierrc.json at ${this.path}`
    )

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
