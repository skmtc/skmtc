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
  packageName: string
  version: string
}

type CreateArgs = {
  projectName: string
  scopeName: string
  packageName: string
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
  packageName: string
  version: string

  private constructor({ projectName, scopeName, packageName, version }: GeneratorArgs) {
    this.projectName = projectName
    this.scopeName = scopeName
    this.packageName = packageName
    this.version = version
  }

  static create({ projectName, scopeName, packageName, version }: CreateArgs) {
    return new Generator({ projectName, scopeName, packageName, version })
  }

  install({ denoJson }: InstallArgs) {
    denoJson.addImport(this.toModuleName(), this.toFullName())
  }

  async add({ project, generatorType }: AddArgs) {
    const generatorPath = join(toProjectPath(project.name), this.packageName)
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

    project.rootDenoJson.addImport(this.toModuleName(), this.toModPath())
    project.rootDenoJson.addWorkspace(this.toPath())
  }

  async createFiles(generatorPath: string, manager: Manager) {
    await Deno.mkdir(generatorPath, { recursive: true })

    await ensureFile(join(generatorPath, 'mod.ts'))

    const packageDenoJson = PackageDenoJson.create(
      {
        path: join(generatorPath, 'deno.json'),
        contents: {
          name: this.toModuleName(),
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

    denoJson.addImport(this.toModuleName(), this.toModPath())
    denoJson.addWorkspace(this.toPath())
  }

  static fromName({ projectName, scopeName, packageName, version }: FromNameArgs): Generator {
    const generator = Generator.create({ projectName, scopeName, packageName, version })

    return generator
  }

  remove(project: Project) {
    const packageSource = project.rootDenoJson.contents.imports?.[this.toModuleName()]

    invariant(packageSource, 'Package source not found')

    const isLocal = RootDenoJson.isLocalModule(packageSource)

    if (isLocal) {
      Deno.remove(join(toProjectPath(project.name), this.packageName))
    }

    project.rootDenoJson.removeGenerator(this)
  }

  toFullName() {
    return `jsr:${this.toModuleName()}@${this.version}`
  }

  toModuleName() {
    return `${this.scopeName}/${this.packageName}`
  }

  toPath() {
    return join(toProjectPath(this.projectName), this.packageName)
  }

  toModPath() {
    return `${this.toPath()}/mod.ts`
  }
}

type FromNameArgs = {
  projectName: string
  scopeName: string
  packageName: string
  version: string
}
