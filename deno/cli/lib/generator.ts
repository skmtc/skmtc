import { Jsr } from './jsr.ts'
import type { RootDenoJson } from './root-deno-json.ts'
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
import { Octokit } from 'octokit'

const octokit = new Octokit({
  auth: Deno.env.get('GITHUB_READ_ONLY_TOKEN')
})

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
  denoJson: RootDenoJson
  localGenerators: Record<string, string>
  manager: Manager
}

type InstallArgs = {
  denoJson: RootDenoJson
}

type AddArgs = {
  project: Project
  generatorType: 'operation' | 'model'
}

type PathOptions = {
  relative?: boolean
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

    project.rootDenoJson.addImport(this.toModuleName(), this.toModPath({ relative: true }))
    project.rootDenoJson.addWorkspace(this.toPath({ relative: true }))
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

  async clone({ denoJson, manager, localGenerators }: CloneArgs) {
    const files = await getGeneratorFiles(this.packageName)

    const downloads = Object.entries(files).map(async ([path, content]) => {
      const joinedPath = join(toProjectPath(this.projectName), path)

      await ensureFile(joinedPath)

      return Deno.writeTextFile(joinedPath, content)
    })

    await Promise.all(downloads)

    denoJson.addImport(this.toModuleName(), this.toModPath({ relative: true }))
    denoJson.addWorkspace(this.toPath({ relative: true }))

    const packageDenoJsonPath = join(this.toPath({ relative: false }), 'deno.json')

    const packageDenoJson = await PackageDenoJson.open(packageDenoJsonPath, manager)

    const updatedImports = Object.entries(packageDenoJson.contents.imports ?? {}).filter(
      ([generatorId]) => !localGenerators[generatorId]
    )

    packageDenoJson.contents.imports = Object.fromEntries(updatedImports)
  }

  static fromName({ projectName, scopeName, packageName, version }: FromNameArgs): Generator {
    const generator = Generator.create({ projectName, scopeName, packageName, version })

    return generator
  }

  remove(project: Project) {
    const packageSource = project.rootDenoJson.contents.imports?.[this.toModuleName()]

    invariant(packageSource, 'Package source not found')

    project.rootDenoJson.removeGenerator(this)
  }

  toFullName() {
    return `jsr:${this.toModuleName()}@${this.version}`
  }

  toModuleName() {
    return `${this.scopeName}/${this.packageName}`
  }

  toPath({ relative }: PathOptions) {
    if (relative) {
      return `./${this.packageName}`
    }

    return join(toProjectPath(this.projectName), this.packageName)
  }

  toModPath({ relative }: PathOptions) {
    return `${this.toPath({ relative })}/mod.ts`
  }
}

type FromNameArgs = {
  projectName: string
  scopeName: string
  packageName: string
  version: string
}

const getGeneratorFiles = async (path: string, files: Record<string, string> = {}) => {
  const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
    owner: 'skmtc',
    repo: 'skmtc-generators',
    path: path,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  const items = Array.isArray(response.data) ? response.data : [response.data]

  const promises = items.map(async item => {
    if (item.type === 'dir') {
      await getGeneratorFiles(item.path, files)
    } else if (item.download_url) {
      const content = await fetch(item.download_url)

      files[item.path] = await content.text()
    }

    return
  })

  await Promise.all(promises)

  return files
}
