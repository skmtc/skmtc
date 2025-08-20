import { Project } from './project.ts'
import type { Manager } from './manager.ts'
import { exists } from '@std/fs'
import { ApiClient } from './api-client.ts'
import { KvState } from './kv-state.ts'
import { toRootPath } from './to-root-path.ts'

type CreateProjectArgs = {
  name: string
  basePath: string
  generators: string[]
}

export class SkmtcRoot {
  projects: Project[]
  manager: Manager
  apiClient: ApiClient
  kvState: KvState

  private constructor(projects: Project[], manager: Manager) {
    this.projects = projects
    this.manager = manager

    this.apiClient = new ApiClient(manager)
    this.kvState = new KvState(manager.kv)
  }

  static toPath() {
    return toRootPath()
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

    const projectDirs = Deno.readDirSync(rootPath).filter(item => item.isDirectory)

    const projectPromises = projectDirs.map(projectDir => Project.open(projectDir.name, manager))

    const projects = await Promise.all(projectPromises)

    return new SkmtcRoot(projects, manager)
  }
}
