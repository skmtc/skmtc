import { Jsr } from './jsr.ts'
import type { DenoJson } from './deno-json.ts'
import type { StackJson } from './stack-json.ts'
import { join } from '@std/path'
import { ensureFile } from '@std/fs'

type GeneratorArgs = {
  scopeName: string
  generatorName: string
  version: string
}

type CreateArgs = {
  scopeName: string
  generatorName: string
}

type CloneArgs = {
  denoJson: DenoJson
  stackJson: StackJson
}

type InstallArgs = {
  denoJson: DenoJson
  stackJson: StackJson
}

export class Generator {
  scopeName: string
  generatorName: string
  version: string

  private constructor({ scopeName, generatorName, version }: GeneratorArgs) {
    this.scopeName = scopeName
    this.generatorName = generatorName
    this.version = version
  }

  static async create({ scopeName, generatorName }: CreateArgs) {
    const meta = await Jsr.getLatestMeta({ scopeName, generatorName })

    return new Generator({ scopeName, generatorName, version: meta.latest })
  }

  install({ denoJson, stackJson }: InstallArgs) {
    denoJson.addImport(this.toPackageName(), this.toFullName())

    stackJson.addGenerator(this)
  }

  async clone({ denoJson, stackJson }: CloneArgs) {
    const files = await Jsr.download(this)

    const downloads = Object.entries(files).map(async ([path, content]) => {
      const joinedPath = join(this.toPath(), path)

      await ensureFile(joinedPath)

      return Deno.writeTextFile(joinedPath, content)
    })

    await Promise.all(downloads)

    denoJson.addImport(this.toPackageName(), this.toModPath())
    denoJson.addWorkspace(this.toPath())

    stackJson.addGenerator(this)
  }

  static async fromName(name: string) {
    if (!name.startsWith('jsr')) {
      throw new Error('Only JSR registry generators are supported')
    }

    const withoutScheme = name.replace(/^jsr:/i, '')

    const [scopeName, generatorName] = withoutScheme.split('/')

    const generator = await Generator.create({ scopeName, generatorName })

    return generator
  }

  toFullName() {
    return `jsr:${this.toPackageName()}@${this.version}`
  }

  toPackageName() {
    return `${this.scopeName}/${this.generatorName}`
  }

  toPath() {
    return `./${this.generatorName}`
  }

  toModPath() {
    return `${this.toPath()}/mod.ts`
  }
}
