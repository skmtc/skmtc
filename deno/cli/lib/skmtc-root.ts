import { Project, isProjectKey } from '@/lib/project.ts'
import type { Manager } from '@/lib/manager.ts'
import { exists } from '@std/fs/exists'
import { ApiClient } from '@/lib/api-client.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import { Jsr } from '@/lib/jsr.ts'
import cliDenoJson from '../deno.json' with { type: 'json' }
import { compare } from '@std/semver/compare'
import { parse } from '@std/semver/parse'
import { createApiServers } from '@/services/createApiServers.generated.ts'
import { RemoteProject } from '@/lib/remote-project.ts'
import invariant from 'tiny-invariant'
import { SchemaFile } from '@/lib/schema-file.ts'
import type { Generator } from '@/types/generator.generated.ts'

type CreateProjectArgs = {
  name: string
  basePath: string
  generators: string[]
  availableGenerators: Generator[]
}

type ToProjectArgs = {
  projectName: string
  schemaPath: string | undefined
  prettierPath?: string
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

  findProject(projectName: string): Project {
    const project = this.projects.find(({ name }) => name === projectName)

    invariant(project, `Project "${projectName}" not found`)

    return project
  }

  get isLoggedIn() {
    return this.manager.auth.isLoggedIn()
  }

  async login() {
    await this.manager.auth.login()
  }

  async logout({ silent }: { silent: boolean }) {
    await this.manager.auth.logout({ silent })
  }

  async toProject({ projectName, schemaPath, prettierPath }: ToProjectArgs) {
    if (isProjectKey(projectName)) {
      const schemaFile = schemaPath
        ? await SchemaFile.openFromSource(schemaPath)
        : SchemaFile.create()

      return await RemoteProject.fromKey({
        projectKey: projectName,
        schemaFile,
        prettierPath,
        manager: this.manager
      })
    }

    return this.findProject(projectName)
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

  async createProject({ name, basePath, generators, availableGenerators }: CreateProjectArgs) {
    const project = await Project.create({
      name,
      basePath,
      generators,
      skmtcRoot: this,
      availableGenerators
    })

    this.projects.push(project)

    await this.manager.cleanup()

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
