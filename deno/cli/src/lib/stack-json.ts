import { ensureDir, exists } from '@std/fs'
import { join } from '@std/path'
import { toRootPath } from './to-root-path.ts'
import { type SkmtcStackConfig, skmtcStackConfig } from '@skmtc/core'
import * as v from 'valibot'
import invariant from 'tiny-invariant'

export class StackJson {
  toPath() {
    const rootPath = toRootPath()

    return join(rootPath, '.settings', 'stack.json')
  }

  async exists() {
    const path = this.toPath()

    return await exists(path, {
      isFile: true
    })
  }

  async read() {
    const hasStackJson = await this.exists()

    if (!hasStackJson) {
      return null
    }

    const stackJson = await Deno.readTextFile(this.toPath())

    return v.parse(skmtcStackConfig, JSON.parse(stackJson))
  }

  async write(stackConfig: SkmtcStackConfig) {
    const stackJsonPath = this.toPath()

    await Deno.writeTextFile(stackJsonPath, JSON.stringify(stackConfig, null, 2))
  }

  async toGenerators() {
    const stackConfig = await this.read()

    return stackConfig?.generators ?? []
  }

  async addGenerator(generator: string) {
    const hasStackJson = await this.exists()

    if (!hasStackJson) {
      await this.create(generator)
    }

    const stackConfig = await this.read()

    invariant(stackConfig, 'Stack JSON not found')

    stackConfig.generators.push(generator)

    await this.write(stackConfig)
  }

  async removeGenerator(generator: string) {
    const hasStackJson = await this.exists()

    if (!hasStackJson) {
      return
    }

    const stackConfig = await this.read()

    invariant(stackConfig, 'Stack JSON not found')

    stackConfig.generators = stackConfig.generators.filter(g => g !== generator)

    await this.write(stackConfig)
  }

  async create(name: string) {
    const rootPath = toRootPath()

    const settingsPath = join(rootPath, '.settings')

    await ensureDir(settingsPath)

    await this.write({ name, generators: [] })
  }
}
