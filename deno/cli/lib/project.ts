import { RootDenoJson } from '@/lib/root-deno-json.ts'
import type { Manager } from '@/lib/manager.ts'
import { Generator } from '@/lib/generator.ts'
import invariant from 'tiny-invariant'
import { Jsr } from '@/lib/jsr.ts'
import { Deployment } from '@/lib/deployment.ts'
import { ClientJson } from '@/lib/client-json.ts'
import { toAssets } from '@/deploy/to-assets.ts'
import { toProjectPath } from '@/lib/to-project-path.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { SchemaFile } from '@/lib/schema-file.ts'
import { formatNumber } from '@skmtc/core/formatNumber'
import { parseModuleName } from '@skmtc/core/parseModuleName'
import { join } from '@std/path/join'
import { Manifest } from '@/lib/manifest.ts'
import type { SkmtcDispatch, SkmtcState, SkmtcMessage } from '@/components/SkmtcContext.tsx'
import type { Generator as GeneratorType } from '@/types/generator.generated.ts'
import { toServer } from './to-server.ts'
import { toWorker } from './to-worker.ts'
import { ensureWorkerDeps } from './ensure-worker-deps.ts'
import { ensureServerDeps } from './ensure-server-deps.ts'

type AddGeneratorArgs = {
  moduleName: string
  type: 'operation' | 'model'
  username: string
}

type CloneGeneratorArgs = {
  projectName: string
  moduleName: string
  /** Bypass the pre-flight @skmtc/core peer-pin check. See `Generator.clone`. */
  force?: boolean
}

export type CloneGeneratorResult = {
  /** Module name with scope, e.g. `@skmtc/gen-shadcn-form`. */
  moduleName: string
  /** Concrete JSR version that was downloaded, e.g. `0.0.55`. */
  version: string
}

type ConstructorArgs = {
  name: string
  rootDenoJson: RootDenoJson
  clientJson: ClientJson
  manifest: Manifest
  manager: Manager
  schemaFile: SchemaFile
}

type DeployArgs = {
  state: SkmtcState
  dispatch: SkmtcDispatch
  dispatchMessage: (payload: SkmtcMessage) => void
}

type InstallGeneratorArgs = {
  moduleName: string
}

type RemoveGeneratorArgs = {
  moduleName: string
}

export type CreateProjectArgs = {
  name: string
  basePath: string
  generators: string[] | undefined
  skmtcRoot: SkmtcRoot
  availableGenerators: GeneratorType[]
}

export class Project {
  name: string
  rootDenoJson: RootDenoJson
  clientJson: ClientJson
  manifest: Manifest
  manager: Manager
  schemaFile: SchemaFile

  private constructor({
    name,
    rootDenoJson,
    clientJson,
    manifest,
    manager,
    schemaFile
  }: ConstructorArgs) {
    this.name = name
    this.rootDenoJson = rootDenoJson
    this.clientJson = clientJson
    this.manifest = manifest
    this.manager = manager
    this.schemaFile = schemaFile
  }

  isRemote() {
    return false
  }

  toPath() {
    return toProjectPath(this.name)
  }

  static async create({
    name,
    basePath,
    generators,
    skmtcRoot,
    availableGenerators = []
  }: CreateProjectArgs) {
    const project = new Project({
      name,
      rootDenoJson: RootDenoJson.create(name),
      clientJson: ClientJson.create({
        path: ClientJson.toPath({ projectPath: toProjectPath(name) }),
        basePath
      }),
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

    await project.clientJson.write()

    await project.rootDenoJson.write()

    skmtcRoot.projects.push(project)

    return project
  }

  //Rename import
  async cloneGenerator({
    projectName,
    moduleName,
    force
  }: CloneGeneratorArgs): Promise<CloneGeneratorResult> {
    try {
      const { scopeName, packageName, version } = parseModuleName(moduleName)

      invariant(scopeName, 'Scope name is required')

      const generator = Generator.fromName({
        projectName,
        scopeName,
        packageName,
        version: version ?? (await Jsr.getLatestMeta({ scopeName, packageName })).latest
      })

      const result = await generator.clone({
        denoJson: this.rootDenoJson,
        manager: this.manager,
        force
      })

      this.rootDenoJson.write()

      return { moduleName: generator.toModuleName(), version: result.version }
    } finally {
      await this.manager.cleanup()
    }
  }

  /**
   * Generate the CF-Workers entry `server.ts` that wraps the project's
   * installed generators in `createServer({ toGeneratorConfigMap })`
   * from `@skmtc/server`. `bundleSplit` (see `lib/bundle-split.ts`)
   * then compiles this entry into `server.js` alongside the two
   * runtime halves and uploads them to skmtc-hub via `skmtc deploy`.
   */
  async createServer() {
    const mod = toServer(this.toGeneratorIds())

    const path = this.toPath()

    const modPath = join(path, 'server.ts')

    await Deno.mkdir(path, { recursive: true })

    await Deno.writeTextFile(modPath, mod)

    // Pin `@skmtc/server` and `@skmtc/core` so the `deno bundle`
    // subprocess can resolve them. Parallels the `ensureWorkerDeps`
    // step in `createWorker`.
    if (ensureServerDeps(this.rootDenoJson)) {
      await this.rootDenoJson.write()
    }

    return modPath
  }

  async createWorker() {
    const mod = toWorker(this.toGeneratorIds())

    const path = this.toPath()

    const modPath = join(path, 'worker.ts')

    await Deno.mkdir(path, { recursive: true })

    await Deno.writeTextFile(modPath, mod)

    // worker.ts does `import toWorker from '@skmtc/worker'`, and the
    // generator source imports `@skmtc/core` — neither is added by the
    // clone import-collector (worker.ts is CLI-generated, not part of
    // any cloned package). Ensure both are pinned, then persist so the
    // `deno bundle` subprocess reads the updated import map.
    if (ensureWorkerDeps(this.rootDenoJson)) {
      await this.rootDenoJson.write()
    }

    return modPath
  }

  async installGenerator({ moduleName }: InstallGeneratorArgs) {
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

      await this.rootDenoJson.write()

      return generator
    } catch (error) {
      console.error(error)

      // Sentry.captureException(error)

      // await Sentry.flush()

      throw error
    } finally {
      await this.manager.cleanup()
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
    } catch (error) {
      console.error(error)

      // Sentry.captureException(error)

      // await Sentry.flush()
    } finally {
      await this.manager.cleanup()
    }
  }

  async removeGenerator({ moduleName }: RemoveGeneratorArgs) {
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
    } catch (error) {
      console.error(error)

      // Sentry.captureException(error)

      // await Sentry.flush()
    } finally {
      await this.manager.cleanup()
    }
  }

  toGeneratorIds() {
    return this.rootDenoJson.toGeneratorIds()
  }

  async deploy({ state, dispatch, dispatchMessage }: DeployArgs) {
    const startTime = Date.now()

    const deployment = new Deployment(this.manager)

    const assets = await toAssets({ projectRoot: toProjectPath(this.name) })

    try {
      const deployed = await deployment.deploy({
        state,
        assets,
        serverName: toServerName(this),
        project: this,
        dispatch
      })

      if (!deployed) {
        throw new Error('Deployment failed')
      }

      const duration = (Date.now() - startTime) / 1000

      dispatchMessage({ success: `Deployed in ${formatNumber(duration)}secs` })

      dispatchMessage({ success: 'Deployment successful' })
    } catch (error) {
      console.error(error)

      // Sentry.captureException(error)

      // await Sentry.flush()

      dispatchMessage({ error: 'Deployment failed' })

      // if (error === 'Deployment failed' && deployment.denoDeploymentId) {
      //   const buildLogs = await deployment.getBuildLogs(deployment.denoDeploymentId)

      //   buildLogs.forEach(log => {
      //     if (log?.message) {
      //       console.error(log.message)
      //     }
      //   })
      //   await this.manager.fail('')
      // } else if (error) {
      //   console.error(error)
      //   await this.manager.fail('Failed to deploy generators')
      // } else {
      //   await this.manager.fail('Failed to deploy generators')
      // }
    } finally {
      await this.manager.cleanup()
    }
  }

  async addGenerator({ moduleName, type, username }: AddGeneratorArgs) {
    try {
      const { scopeName, packageName, version } = parseModuleName(moduleName)

      const generator = Generator.fromName({
        projectName: this.name,
        scopeName: scopeName ?? (username ? `@${username}` : undefined) ?? 'jsr-user',
        packageName,
        version: version ?? '0.0.1'
      })

      generator.add({ project: this, generatorType: type })
    } catch (error) {
      console.error(error)

      // Sentry.captureException(error)

      // await Sentry.flush()
    } finally {
      await this.manager.cleanup()
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

    const manifest = await Manifest.open(name)

    const schemaFile = await SchemaFile.openFromProject(name, clientJson.contents?.source)

    return new Project({
      name,
      rootDenoJson,
      clientJson,
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
  options: GeneratorType[] | undefined
  generatorIds: Set<string>
}

export const getDependencyIds = ({
  checkedIds,
  options = [],
  generatorIds
}: GetDependencyIdsArgs): Set<string> => {
  let count = 0

  for (const option of options) {
    const generatorId = `@${option.scope}/${option.packageName}`
    // Skip if already checked
    if (checkedIds.has(generatorId)) {
      continue
    }

    // Skip if not in TODO list
    if (!generatorIds.has(generatorId)) {
      continue
    }

    // Add to checked ids
    checkedIds.add(generatorId)

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
