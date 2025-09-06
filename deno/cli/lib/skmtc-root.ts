import { Project } from './project.ts'
import type { Manager } from './manager.ts'
import { exists } from '@std/fs/exists'
import { ApiClient } from './api-client.ts'
import { toRootPath } from './to-root-path.ts'
import { Jsr } from './jsr.ts'
import cliDenoJson from '../deno.json' with { type: 'json' }
import { compare } from '@std/semver/compare'
import { parse } from '@std/semver/parse'
import { createApiServers } from '../services/createApiServers.generated.ts'
import { RemoteProject } from './remote-project.ts'
import invariant from 'tiny-invariant'
import { SchemaFile } from './schema-file.ts'
type CreateProjectArgs = {
  name: string
  basePath: string
  generators: string[]
}

export class SkmtcRoot {
  projects: Project[]
  manager: Manager
  apiClient: ApiClient

  private constructor(projects: Project[], manager: Manager) {
    this.projects = projects
    this.manager = manager

    this.apiClient = new ApiClient(manager)
  }

  static toPath() {
    return toRootPath()
  }

  async upgradeCheck() {
    const meta = await Jsr.getLatestMeta({ scopeName: '@skmtc', packageName: 'cli' })

    const latestVersion = meta.latest

    const thisVersion = cliDenoJson.version

    const isUpToDate = compare(parse(thisVersion), parse(latestVersion)) >= 0

    if (isUpToDate) {
      return
    }

    console.log(`Skmtc CLI v${latestVersion} is available. You are running v${thisVersion}.`)
  }

  get isLoggedIn() {
    return this.manager.auth.isLoggedIn()
  }

  async login() {
    await this.manager.auth.login()
  }

  async logout() {
    await this.manager.auth.logout()
  }

  async toProject(projectKey: string, schemaPath: string | undefined) {
    if (projectKey.startsWith('@')) {
      invariant(schemaPath, 'Schema path is required for remote projects')

      const schemaFile = await SchemaFile.openFromPath(schemaPath)

      invariant(schemaFile, 'Schema file not found')

      return RemoteProject.fromKey({ projectKey, schemaFile, manager: this.manager })
    }

    const project = this.projects.find(({ name }) => name === projectKey)

    invariant(project, `Project "${projectKey}" not found`)

    return project
  }

  async createDenoProject(serverName: string) {
    const project = await createApiServers({
      supabase: this.manager.auth.supabase,
      body: {
        serverName
      }
    })

    return project
  }

  async createProject({ name, basePath, generators }: CreateProjectArgs) {
    const project = await Project.create({ name, basePath, generators, skmtcRoot: this })

    this.projects.push(project)

    return project
  }

  static async open(manager: Manager) {
    const rootPath = SkmtcRoot.toPath()

    const hasRoot = await exists(rootPath, { isDirectory: true })

    if (!hasRoot) {
      return new SkmtcRoot([], manager)
    }

    const projectDirs = Array.from(Deno.readDirSync(rootPath)).filter(item => {
      return item.isDirectory && !item.name.startsWith('@')
    })

    const projectPromises = projectDirs.map(projectDir => Project.open(projectDir.name, manager))

    const projects = await Promise.all(projectPromises)

    return new SkmtcRoot(projects, manager)
  }
}
