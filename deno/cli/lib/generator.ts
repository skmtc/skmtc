import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { join } from '@std/path/join'
import { ensureFile } from '@std/fs/ensure-file'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { match } from 'ts-pattern'
import { OperationGenerator } from '@/lib/operation-generator.ts'
import { ModelGenerator } from '@/lib/model-generator.ts'
import { PackageDenoJson } from '@/lib/package-deno-json.ts'
import type { Manager } from '@/lib/manager.ts'
import type { Project } from '@/lib/project.ts'
import invariant from 'tiny-invariant'
import { extractImportPaths } from '@/lib/extract-import-paths.ts'
import * as v from 'valibot'
import { githubContentsResponse, type GitHubContentItem } from '@/lib/github-api-types.ts'

/**
 * Fetches repository contents from GitHub API.
 *
 * @param path - Path to file or directory in the repository
 * @returns Array of content items (normalized from single or array response)
 */
async function fetchGitHubContents(path: string): Promise<GitHubContentItem[]> {
  const token = Deno.env.get('GITHUB_READ_ONLY_TOKEN')

  const url = `https://api.github.com/repos/skmtc/skmtc-generators/contents/${path}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Validate response with valibot
  const validated = v.parse(githubContentsResponse, data)

  // Normalize to array
  return Array.isArray(validated) ? validated : [validated]
}

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
  generatorsDenoJson: Record<string, unknown>
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

  async clone({ denoJson, manager, localGenerators, generatorsDenoJson }: CloneArgs) {
    const files = await getGeneratorFiles(this.packageName)

    const downloads = Object.entries(files).map(async ([path, content]) => {
      const joinedPath = join(toProjectPath(this.projectName), path)

      await ensureFile(joinedPath)

      return Deno.writeTextFile(joinedPath, content)
    })

    await Promise.all(downloads)

    const packageDenoJsonPath = join(this.toPath({ relative: false }), 'deno.json')

    const packageDenoJson = await PackageDenoJson.open(packageDenoJsonPath, manager)

    // Extract imports from all files and add them to denoJson
    const generatorImports = generatorsDenoJson.imports as Record<string, string> | undefined
    if (generatorImports) {
      const importsToAdd = new Set<string>()

      // Process each file to extract imports
      for (const [filePath, content] of Object.entries(files)) {
        // Only process TypeScript files
        if (filePath.endsWith('.ts')) {
          const importPaths = extractImportPaths(content)
          importPaths.forEach(path => importsToAdd.add(path))
        }
      }

      // Add each import to denoJson if it exists in generatorsDenoJson.imports
      for (const importModule of importsToAdd) {
        let source: string | undefined = generatorImports[importModule]

        // If using relative import, use the local import
        if (source?.startsWith('./')) {
          source = packageDenoJson.contents.imports?.[importModule]
        }

        if (source) {
          denoJson.addImport(importModule, source)
        }
      }
    }

    denoJson.addImport(this.toModuleName(), this.toModPath({ relative: true }))
    denoJson.addWorkspace(this.toPath({ relative: true }))
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

  static async getGeneratorsRootDenoJson() {
    const items = await fetchGitHubContents('deno.json')

    const promises = items.map(async item => {
      if (item.type === 'file' && item.path === 'deno.json' && item.download_url) {
        const content = await fetch(item.download_url)

        return await content.text()
      }

      return null
    })

    const results = await Promise.all(promises)

    const result = results.find(result => result !== null)

    invariant(result, 'Generators root deno json not found')

    return JSON.parse(result)
  }
}

type FromNameArgs = {
  projectName: string
  scopeName: string
  packageName: string
  version: string
}

const getGeneratorFiles = async (path: string, files: Record<string, string> = {}) => {
  const items = await fetchGitHubContents(path)

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
