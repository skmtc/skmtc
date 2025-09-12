import { RootDenoJson } from './root-deno-json.ts'
import type { Manager } from './manager.ts'
import { Generator } from './generator.ts'
import * as Sentry from '@sentry/node'
import invariant from 'tiny-invariant'
import { Jsr } from './jsr.ts'
import { Deployment } from './deployment.ts'
import { ClientJson } from './client-json.ts'
import { toAssets } from '../deploy/to-assets.ts'
import { toProjectPath } from './to-project-path.ts'
import { PrettierJson } from './prettier-json.ts'
import type { SkmtcRoot } from './skmtc-root.ts'
import { availableGenerators, type AvailableGenerator } from '../available-generators.ts'
import { SchemaFile } from './schema-file.ts'
import { formatNumber, parseModuleName } from '@skmtc/core'
import { PackageDenoJson } from './package-deno-json.ts'
import { join } from '@std/path/join'
import type { ApiClient } from './api-client.ts'
import { Manifest } from './manifest.ts'
import { getApiServersServerNameHasWriteAccess } from '../services/getApiServersServerNameHasWriteAccess.generated.ts'
import { Confirm } from '@cliffy/prompt/confirm'
type AddGeneratorArgs = {
  moduleName: string
  type: 'operation' | 'model'
}

type CloneGeneratorArgs = {
  projectName: string
  moduleName: string
}

type AddGeneratorOptions = {
  logSuccess?: string
}

type ConstructorArgs = {
  name: string
  rootDenoJson: RootDenoJson
  clientJson: ClientJson
  prettierJson: PrettierJson | null
  manifest: Manifest
  manager: Manager
  schemaFile: SchemaFile
}

type DeployOptions = {
  logSuccess?: string
}

type InstallGeneratorArgs = {
  moduleName: string
}

type InstallOptions = {
  logSuccess?: string
}

type RemoveGeneratorArgs = {
  moduleName: string
}

type RemoveOptions = {
  logSuccess?: string
}

type CreateArgs = {
  name: string
  basePath: string
  generators: string[]
  skmtcRoot: SkmtcRoot
}

type CloneOptions = {
  logSuccess?: string
}

export class Project {
  name: string
  rootDenoJson: RootDenoJson
  clientJson: ClientJson
  prettierJson: PrettierJson | null
  manifest: Manifest
  manager: Manager
  schemaFile: SchemaFile

  private constructor({
    name,
    rootDenoJson,
    clientJson,
    prettierJson,
    manifest,
    manager,
    schemaFile
  }: ConstructorArgs) {
    this.name = name
    this.rootDenoJson = rootDenoJson
    this.clientJson = clientJson
    this.manifest = manifest
    this.prettierJson = prettierJson
    this.manager = manager
    this.schemaFile = schemaFile
  }

  toPath() {
    return toProjectPath(this.name)
  }

  static async create({ name, basePath, generators, skmtcRoot }: CreateArgs) {
    const project = new Project({
      name,
      rootDenoJson: RootDenoJson.create(name),
      clientJson: ClientJson.create({
        path: ClientJson.toPath({ projectPath: toProjectPath(name) }),
        basePath
      }),
      prettierJson: PrettierJson.create({ path: PrettierJson.toPath(name), contents: {} }),
      manifest: await Manifest.open(name),
      manager: skmtcRoot.manager,
      schemaFile: SchemaFile.create()
    })

    const generatorIdSet = getDependencyIds({
      checkedIds: new Set(),
      options: availableGenerators,
      generatorIds: new Set(generators)
    })

    for (const generatorId of generatorIdSet) {
      await project.installGenerator({ moduleName: `jsr:${generatorId}` })
    }

    await project.prettierJson?.write()

    await project.clientJson.write()

    await project.rootDenoJson.write()

    return project
  }

  //Rename import
  async cloneGenerator(
    { projectName, moduleName }: CloneGeneratorArgs,
    { logSuccess }: CloneOptions = {}
  ) {
    try {
      const { scopeName, packageName, version } = parseModuleName(moduleName)

      invariant(scopeName, 'Scope name is required')

      const generator = Generator.fromName({
        projectName,
        scopeName,
        packageName,
        version: version ?? (await Jsr.getLatestMeta({ scopeName, packageName })).latest
      })

      const generatorIds = this.toGeneratorIds()

      const filteredImportEntries = Object.entries(this.rootDenoJson.contents.imports ?? {}).filter(
        ([generatorId]) => generatorIds.includes(generatorId)
      )

      await generator.clone({
        denoJson: this.rootDenoJson,
        manager: this.manager,
        localGenerators: Object.fromEntries(filteredImportEntries)
      })

      const clonedGeneratorId = generator.toModuleName()

      generatorIds.forEach(async generatorId => {
        const { packageName } = parseModuleName(generatorId)

        const packageDenoJsonPath = join(this.toPath(), packageName, 'deno.json')

        if (await PackageDenoJson.exists(packageDenoJsonPath)) {
          const packageDenoJson = await PackageDenoJson.open(packageDenoJsonPath, this.manager)

          if (packageDenoJson.contents.imports?.[clonedGeneratorId]) {
            delete packageDenoJson.contents.imports[clonedGeneratorId]

            // TODO: Writing should be done in manager.success()
            await packageDenoJson.write()
          }
        }
      })

      await this.manager.success()
    } catch (error) {
      console.error(error)

      Sentry.captureException(error)

      await Sentry.flush()

      await this.manager.fail('Failed to clone generator')
    }
  }

  async installGenerator(
    { moduleName }: InstallGeneratorArgs,
    { logSuccess }: InstallOptions = {}
  ) {
    try {
      const { scopeName, packageName, version } = parseModuleName(moduleName)

      // invariant(scheme === 'jsr', 'Only JSR registry generators are supported')
      invariant(scopeName, 'Scope name is required')

      const generator = Generator.fromName({
        projectName: this.name,
        scopeName,
        packageName,
        version: version ?? (await Jsr.getLatestMeta({ scopeName, packageName })).latest
      })

      generator.install({ denoJson: this.rootDenoJson })

      await this.manager.success()

      return generator
    } catch (error) {
      console.error(error)

      Sentry.captureException(error)

      await Sentry.flush()

      await this.manager.fail('Failed to install generator')
    }
  }

  toManifestPath() {
    return join(this.toPath(), '.settings', 'manifest.json')
  }

  async rename(newName: string) {
    try {
      await Deno.rename(this.toPath(), toProjectPath(newName))

      this.name = newName

      this.clientJson.path = ClientJson.toPath({ projectPath: toProjectPath(newName) })
      this.rootDenoJson.projectName = newName

      await this.manager.success()
    } catch (error) {
      console.error(error)

      Sentry.captureException(error)

      await Sentry.flush()

      await this.manager.fail('Failed to rename project')
    }
  }

  async ensureDeployment(): Promise<boolean> {
    const projectKey = this.clientJson.contents?.projectKey

    if (projectKey) {
      return true
    }

    const confirmed = await Confirm.prompt(
      'This project has not been deployed. Would you like to deploy it now?'
    )

    if (!confirmed) {
      return false
    }

    await this.deploy({ logSuccess: 'Generators deployed' })

    return true
  }

  async ensureSchemaFile() {
    await this.schemaFile.promptOrFail(this)
  }

  async removeGenerator({ moduleName }: RemoveGeneratorArgs, { logSuccess }: RemoveOptions = {}) {
    try {
      const { scopeName, packageName, version } = parseModuleName(moduleName)

      invariant(scopeName, 'Scope name is required')

      const generator = Generator.fromName({
        projectName: this.name,
        scopeName,
        packageName,
        version: version ?? ''
      })

      generator.remove(this)

      await this.manager.success()
    } catch (error) {
      console.error(error)

      Sentry.captureException(error)

      await Sentry.flush()

      await this.manager.fail('Failed to remove generator')
    }
  }

  toGeneratorIds() {
    return this.rootDenoJson.toGeneratorIds()
  }

  async hasServerWriteAccess(apiClient: ApiClient) {
    const projectKey = this.clientJson.contents?.projectKey

    if (!projectKey) {
      return true
    }

    const [_accountName, serverName] = projectKey.split('/')

    if (!serverName) {
      return true
    }

    const { hasWriteAccess } = await getApiServersServerNameHasWriteAccess({
      serverName,
      supabase: apiClient.manager.auth.supabase
    })

    return hasWriteAccess
  }

  async deploy({ logSuccess }: DeployOptions = {}) {
    // await this.manager.auth.ensureAuth()

    const startTime = Date.now()

    const deployment = new Deployment(this.manager)

    const assets = await toAssets({ projectRoot: toProjectPath(this.name) })

    try {
      await deployment.deploy({
        assets,
        serverName: toServerName(this),
        project: this
      })

      const duration = (Date.now() - startTime) / 1000

      console.log(`Deployed in ${formatNumber(duration)}secs`)

      await this.manager.success()
    } catch (error) {
      console.error(error)

      Sentry.captureException(error)

      await Sentry.flush()

      if (error === 'Deployment failed' && deployment.denoDeploymentId) {
        const buildLogs = await deployment.getBuildLogs(deployment.denoDeploymentId)

        buildLogs.forEach(log => {
          if (log?.message) {
            console.error(log.message)
          }
        })
        await this.manager.fail('')
      } else if (error) {
        console.error(error)
        await this.manager.fail('Failed to deploy generators')
      } else {
        await this.manager.fail('Failed to deploy generators')
      }
    }
  }

  async addGenerator(
    { moduleName, type }: AddGeneratorArgs,
    { logSuccess }: AddGeneratorOptions = {}
  ) {
    try {
      const { scopeName, packageName, version } = parseModuleName(moduleName)

      invariant(scopeName, 'Scope name is required')

      const generator = Generator.fromName({
        projectName: this.name,
        scopeName,
        packageName,
        version: version ?? '0.0.1'
      })

      generator.add({ project: this, generatorType: type })
    } catch (error) {
      console.error(error)

      Sentry.captureException(error)

      await Sentry.flush()

      await this.manager.fail('Failed to add generator')
    }
  }

  toProjectKey(): ProjectKey {
    const projectKey = this.clientJson.contents?.projectKey

    invariant(
      projectKey,
      'Project is missing "projectKey" in ".settings/client.json". Has it been deployed?'
    )

    return toProjectKey(projectKey)
  }

  static async open(name: string, manager: Manager) {
    const rootDenoJson = await RootDenoJson.open(name, manager)

    const clientJson = await ClientJson.open({
      path: ClientJson.toPath({ projectPath: toProjectPath(name) }),
      manager
    })

    const prettierJson = await PrettierJson.openFromPath(PrettierJson.toPath(name))

    const manifest = await Manifest.open(name)

    const schemaFile = await SchemaFile.openFromProject(name, clientJson.contents?.source)

    return new Project({
      name,
      rootDenoJson,
      clientJson,
      prettierJson,
      manifest,
      manager,
      schemaFile
    })
  }
}

const toServerName = (project: Project) => {
  const projectKey = project.clientJson.contents?.projectKey

  if (!projectKey) {
    return project.name
  }

  const [_accountName, serverName] = projectKey.split('/')

  invariant(serverName, 'Server name not found')

  return serverName
}

type GetDependencyIdsArgs = {
  checkedIds: Set<string>
  options: AvailableGenerator[]
  generatorIds: Set<string>
}

export const getDependencyIds = ({
  checkedIds,
  options,
  generatorIds
}: GetDependencyIdsArgs): Set<string> => {
  let count = 0

  for (const option of options) {
    // Skip if already checked
    if (checkedIds.has(option.id)) {
      continue
    }

    // Skip if not in TODO list
    if (!generatorIds.has(option.id)) {
      continue
    }

    // Add to checked ids
    checkedIds.add(option.id)

    const sizeBefore = generatorIds.size

    option.dependencies.forEach(id => generatorIds.add(id))

    const sizeAfter = generatorIds.size

    // If new items were added, increment count
    if (sizeAfter > sizeBefore) {
      count++
    }
  }

  // If loop had no new additions, return the set
  return count === 0 ? generatorIds : getDependencyIds({ checkedIds, options, generatorIds })
}

export type ProjectKey = `@${string}/${string}`

export const isProjectKey = (value: string): value is ProjectKey => {
  if (!value.startsWith('@')) {
    return false
  }

  const chunks = value.split('/')

  if (chunks.length !== 2) {
    return false
  }

  const [accountName, projectName] = chunks

  if (accountName.length < 4 || projectName.length < 3) {
    return false
  }

  if (projectName.startsWith('gen-')) {
    throw new Error('Project name cannot start with "gen-"')
  }

  return true
}

export const toProjectKey = (value: string): ProjectKey => {
  if (isProjectKey(value)) {
    return value
  }

  throw new Error('Project key must be in the format "@<accountName>/<projectName>"')
}
