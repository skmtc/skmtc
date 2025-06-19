import { exists } from '@std/fs'
import { toRootPath } from './to-root-path.ts'
import { join } from '@std/path'
import { writeFile } from './file.ts'
import * as v from 'valibot'
import { rootDenoJson, type RootDenoJson } from '@skmtc/core'
import invariant from 'tiny-invariant'
import type { Generator } from './generator.ts'

export class DenoJson {
  toPath() {
    const rootPath = toRootPath()

    return join(rootPath, 'deno.json')
  }

  async exists() {
    const denoJsonPath = this.toPath()

    return await exists(denoJsonPath, {
      isFile: true
    })
  }

  async read() {
    const hasDenoJson = await this.exists()

    if (!hasDenoJson) {
      return null
    }

    const denoJsonPath = this.toPath()

    const denoJson = await Deno.readTextFile(denoJsonPath)

    return v.parse(rootDenoJson, JSON.parse(denoJson))
  }

  async write(denoJson: RootDenoJson) {
    const denoJsonPath = this.toPath()

    await writeFile({
      content: JSON.stringify(denoJson),
      resolvedPath: denoJsonPath
    })
  }

  async addGenerator(generator: Generator) {
    const hasDenoJson = await this.exists()

    if (!hasDenoJson) {
      await this.write({})
    }

    const denoJson = await this.read()

    invariant(denoJson, 'Deno JSON not found')

    const newDenoJson = generator.addToDenoJson(denoJson)

    await this.write(newDenoJson)
  }
}
