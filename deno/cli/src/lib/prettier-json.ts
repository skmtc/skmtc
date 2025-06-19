import { exists } from '@std/fs'
import { toRootPath } from './to-root-path.ts'
import { join } from '@std/path'
import { writeFile } from './file.ts'
import * as v from 'valibot'
import { prettierConfigType, type PrettierConfigType } from '@skmtc/core'

export class PrettierJson {
  contents: PrettierConfigType

  private constructor(contents: PrettierConfigType) {
    this.contents = contents
  }

  static toPath() {
    const rootPath = toRootPath()

    return join(rootPath, 'prettier.json')
  }

  static async exists(): Promise<boolean> {
    const prettierJsonPath = PrettierJson.toPath()

    return await exists(prettierJsonPath, { isFile: true })
  }

  static async open(): Promise<PrettierJson | null> {
    const hasPrettierJson = await PrettierJson.exists()

    if (!hasPrettierJson) {
      throw new Error('Prettier JSON not found')
    }

    const prettierJson = await Deno.readTextFile(PrettierJson.toPath())

    const contents = v.parse(prettierConfigType, JSON.parse(prettierJson))

    return new PrettierJson(contents)
  }

  async write() {
    await writeFile({
      content: JSON.stringify(this.contents),
      resolvedPath: PrettierJson.toPath()
    })
  }

  static create() {
    return new PrettierJson({
      tabWidth: 2,
      useTabs: false,
      semi: false,
      singleQuote: true,
      bracketSpacing: true
    })
  }
}
