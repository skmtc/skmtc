import { ensureDir, exists } from '@std/fs'
import { join } from '@std/path'
import { toRootPath } from './to-root-path.ts'
import { type SkmtcStackConfig, skmtcStackConfig } from '@skmtc/core'
import * as v from 'valibot'
import type { Generator } from './generator.ts'

export class StackJson {
  contents: SkmtcStackConfig

  private constructor(contents: SkmtcStackConfig) {
    this.contents = contents
  }

  static toPath() {
    const rootPath = toRootPath()

    return join(rootPath, '.settings', 'stack.json')
  }

  static async exists(): Promise<boolean> {
    const path = StackJson.toPath()

    return await exists(path, { isFile: true })
  }

  static async open(): Promise<StackJson> {
    const hasStackJson = await StackJson.exists()

    if (!hasStackJson) {
      throw new Error('Stack JSON not found')
    }

    const stackJson = await Deno.readTextFile(this.toPath())

    const contents = v.parse(skmtcStackConfig, JSON.parse(stackJson))

    return new StackJson(contents)
  }

  async write() {
    const settingsPath = join(toRootPath(), '.settings')

    await ensureDir(settingsPath)

    const stackJsonPath = StackJson.toPath()

    await Deno.writeTextFile(stackJsonPath, JSON.stringify(this.contents, null, 2))
  }

  addGenerator(generator: Generator) {
    this.contents = {
      ...this.contents,
      generators: [...(this.contents?.generators ?? []), generator.toPackageName()]
    }
  }

  removeGenerator(generator: string) {
    if (!this.contents) {
      return
    }

    this.contents = {
      ...this.contents,
      generators: this.contents.generators.filter(g => g !== generator)
    }
  }

  static create(name: string) {
    return new StackJson({ name, generators: [] })
  }
}
