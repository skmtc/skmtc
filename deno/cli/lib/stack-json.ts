import { ensureDir, existsSync } from '@std/fs'
import { join } from '@std/path'
import { toRootPath } from './to-root-path.ts'
import { type SkmtcStackConfig, skmtcStackConfig } from '@skmtc/core'
import * as v from 'valibot'
import type { Generator } from './generator.ts'
import type { Manager } from './manager.ts'

export class StackJson {
  contents: SkmtcStackConfig

  private constructor(contents: SkmtcStackConfig) {
    this.contents = contents
  }

  static toPath() {
    const rootPath = toRootPath()

    return join(rootPath, '.settings', 'stack.json')
  }

  static exists(): boolean {
    const path = StackJson.toPath()

    return existsSync(path)
  }

  static async open(manager?: Manager): Promise<StackJson> {
    const hasStackJson = StackJson.exists()

    if (!hasStackJson) {
      throw new Error('Stack JSON not found')
    }

    const contents = await Deno.readTextFile(this.toPath())

    const parsed = v.parse(skmtcStackConfig, JSON.parse(contents))
    const stackJson = new StackJson(parsed)

    manager?.cleanupActions.push(async () => await stackJson.write())

    return stackJson
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

  removeGenerator(generator: Generator) {
    if (!this.contents) {
      return
    }

    const packageName = generator.toPackageName()

    this.contents = {
      ...this.contents,
      generators: this.contents.generators.filter(g => g !== packageName)
    }
  }

  static create(name: string) {
    return new StackJson({ name, generators: [] })
  }
}
