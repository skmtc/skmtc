import { Jsr } from './jsr.ts'
import type { StackJson } from './stack-json.ts'
import { RootDenoJson } from './root-deno-json.ts'
import { join } from '@std/path'
import { ensureFile } from '@std/fs'
import { toRootPath } from './to-root-path.ts'
import { match } from 'ts-pattern'
import { OperationGenerator } from './operation-generator.ts'
import { ModelGenerator } from './model-generator.ts'
import { PackageDenoJson } from './package-deno-json.ts'
import type { Manager } from './manager.ts'

type GeneratorArgs = {
  scopeName: string
  generatorName: string
  version: string
}

type CreateArgs = {
  scopeName: string
  generatorName: string
  version: string
}

type CloneArgs = {
  denoJson: RootDenoJson
  stackJson: StackJson
}

type InstallArgs = {
  denoJson: RootDenoJson
  stackJson: StackJson
}

type AddArgs = {
  denoJson: RootDenoJson
  stackJson: StackJson
  generatorType: 'operation' | 'model'
  manager: Manager
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

  static create({ scopeName, generatorName, version }: CreateArgs) {
    return new Generator({ scopeName, generatorName, version })
  }

  static parseName(name: string) {
    const [first, second] = name.split('/')

    const firstChunks = first.split(':')
    const secondChunks = second.split('@')

    const { scheme, scopeName } =
      firstChunks.length === 2
        ? {
            scheme: firstChunks[0],
            scopeName: firstChunks[1]
          }
        : {
            scheme: null,
            scopeName: first
          }

    const { generatorName, version } =
      secondChunks.length === 2
        ? {
            generatorName: secondChunks[0],
            version: secondChunks[1]
          }
        : { generatorName: second, version: null }

    return { scheme, scopeName, generatorName, version }
  }

  install({ denoJson, stackJson }: InstallArgs) {
    denoJson.addImport(this.toPackageName(), this.toFullName())

    stackJson.addGenerator(this)
  }

  async add({ denoJson, stackJson, generatorType, manager }: AddArgs) {
    const generatorPath = join(toRootPath(), '.apifoundry', this.generatorName)
    await this.createFiles(generatorPath, manager)

    await match(generatorType)
      .with('operation', async () => {
        const operationGenerator = new OperationGenerator(this)
        await operationGenerator.createOperationFiles(generatorPath)
      })
      .with('model', async () => {
        const modelGenerator = new ModelGenerator(this)
        await modelGenerator.createModelFiles(generatorPath)
      })
      .exhaustive()

    denoJson.addImport(this.toPackageName(), this.toModPath())
    denoJson.addWorkspace(this.toPath())

    stackJson.addGenerator(this)
  }

  async createFiles(generatorPath: string, manager: Manager) {
    await Deno.mkdir(generatorPath, { recursive: true })

    await ensureFile(join(generatorPath, 'mod.ts'))

    const packageDenoJson = PackageDenoJson.create(
      {
        path: join(generatorPath, 'deno.json'),
        contents: {
          name: this.toPackageName(),
          version: this.version,
          exports: './mod.ts'
        }
      },
      manager
    )

    await packageDenoJson.write()
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

  static fromName({ scopeName, generatorName, version }: FromNameArgs): Generator {
    const generator = Generator.create({ scopeName, generatorName, version })

    return generator
  }

  remove(denoJson: RootDenoJson, stackJson: StackJson) {
    const isLocal = RootDenoJson.isLocalModule(this.toPackageName())

    if (isLocal) {
      Deno.remove(join(toRootPath(), '.apifoundry', this.generatorName))
    }

    denoJson.removeGenerator(this)
    stackJson.removeGenerator(this)
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

type FromNameArgs = {
  scopeName: string
  generatorName: string
  version: string
}
