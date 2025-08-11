import { Jsr } from './jsr.ts'
import { RootDenoJson } from './root-deno-json.ts'
import { join } from '@std/path'
import { ensureFile } from '@std/fs'
import { toProjectPath } from './to-project-path.ts'
import { match } from 'ts-pattern'
import { OperationGenerator } from './operation-generator.ts'
import { ModelGenerator } from './model-generator.ts'
import { PackageDenoJson } from './package-deno-json.ts'
import type { Manager } from './manager.ts'
import type { Project } from './project.ts'
import invariant from 'tiny-invariant'

type GeneratorArgs = {
  projectName: string
  scopeName: string
  generatorName: string
  version: string
}

type CreateArgs = {
  projectName: string
  scopeName: string
  generatorName: string
  version: string
}

type CloneArgs = {
  projectName: string
  denoJson: RootDenoJson
}

type InstallArgs = {
  denoJson: RootDenoJson
}

type AddArgs = {
  project: Project
  generatorType: 'operation' | 'model'
}

export class Generator {
  projectName: string
  scopeName: string
  generatorName: string
  version: string

  private constructor({ projectName, scopeName, generatorName, version }: GeneratorArgs) {
    this.projectName = projectName
    this.scopeName = scopeName
    this.generatorName = generatorName
    this.version = version
  }

  static create({ projectName, scopeName, generatorName, version }: CreateArgs) {
    return new Generator({ projectName, scopeName, generatorName, version })
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

  install({ denoJson }: InstallArgs) {
    denoJson.addImport(this.toPackageName(), this.toFullName())
  }

  async add({ project, generatorType }: AddArgs) {
    const generatorPath = join(toProjectPath(project.name), this.generatorName)
    await this.createFiles(generatorPath, project.manager)

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

    project.rootDenoJson.addImport(this.toPackageName(), this.toModPath())
    project.rootDenoJson.addWorkspace(this.toPath())
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

  async clone({ denoJson }: CloneArgs) {
    const files = await Jsr.download(this)

    const downloads = Object.entries(files).map(async ([path, content]) => {
      const joinedPath = join(this.toPath(), path)

      await ensureFile(joinedPath)

      return Deno.writeTextFile(joinedPath, content)
    })

    await Promise.all(downloads)

    denoJson.addImport(this.toPackageName(), this.toModPath())
    denoJson.addWorkspace(this.toPath())
  }

  static fromName({ projectName, scopeName, generatorName, version }: FromNameArgs): Generator {
    const generator = Generator.create({ projectName, scopeName, generatorName, version })

    return generator
  }

  remove(project: Project) {
    const packageSource = project.rootDenoJson.contents.imports?.[this.toPackageName()]

    invariant(packageSource, 'Package source not found')

    const isLocal = RootDenoJson.isLocalModule(packageSource)

    if (isLocal) {
      Deno.remove(join(toProjectPath(project.name), this.generatorName))
    }

    project.rootDenoJson.removeGenerator(this)
  }

  toFullName() {
    return `jsr:${this.toPackageName()}@${this.version}`
  }

  toPackageName() {
    return `${this.scopeName}/${this.generatorName}`
  }

  toPath() {
    return join(toProjectPath(this.projectName), this.generatorName)
  }

  toModPath() {
    return `${this.toPath()}/mod.ts`
  }
}

type FromNameArgs = {
  projectName: string
  scopeName: string
  generatorName: string
  version: string
}
