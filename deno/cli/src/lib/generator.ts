import { match } from 'ts-pattern'
import { Jsr } from './jsr.ts'
import type { RootDenoJson } from '@skmtc/core'

type GeneratorArgs = {
  scopeName: string
  generatorName: string
  version: string
  definition: GeneratorDefinition
}

type CreateArgs = {
  scopeName: string
  generatorName: string
  definition: GeneratorDefinition
}

type GeneratorDefinition = 'jsr' | 'local'

export class Generator {
  scopeName: string
  generatorName: string
  version: string
  definition: GeneratorDefinition

  private constructor({ scopeName, generatorName, version, definition }: GeneratorArgs) {
    this.scopeName = scopeName
    this.generatorName = generatorName
    this.version = version
    this.definition = definition
  }

  static async create({ scopeName, generatorName, definition }: CreateArgs) {
    const meta = await Jsr.getLatestMeta({ scopeName, generatorName })

    return new Generator({ scopeName, generatorName, version: meta.latest, definition })
  }

  addToDenoJson(denoJson: RootDenoJson) {
    return match(this as Generator)
      .with({ definition: 'jsr' }, matched => ({
        ...denoJson,
        imports: {
          ...denoJson.imports,
          [matched.toPackageName()]: matched.toSource()
        }
      }))
      .with({ definition: 'local' }, matched => ({
        ...denoJson,
        imports: {
          ...denoJson.imports,
          [matched.toPackageName()]: matched.toSource()
        },
        workspace: [...(denoJson.workspace ?? []), matched.toPath()]
      }))
      .exhaustive()
  }

  static async fromName(name: string) {
    if (!name.startsWith('jsr')) {
      throw new Error('Only JSR registry generators are supported')
    }

    const withoutScheme = name.replace(/^jsr:/i, '')

    const [scopeName, generatorName] = withoutScheme.split('/')

    const generator = await Generator.create({ scopeName, generatorName, definition: 'jsr' })

    return generator
  }

  toPackageName() {
    return `${this.scopeName}/${this.generatorName}`
  }

  toPath() {
    return `./${this.generatorName}`
  }

  toSource() {
    return match(this.definition)
      .with('jsr', () => `jsr:${this.scopeName}/${this.generatorName}@${this.version}`)
      .with('local', () => `${this.toPath()}/mod.ts`)
      .exhaustive()
  }
}
