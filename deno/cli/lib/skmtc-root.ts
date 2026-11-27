import { Project } from '@/lib/project.ts'
import type { Manager } from '@/lib/manager.ts'
import { exists } from '@std/fs/exists'
import { toRootPath } from '@/lib/to-root-path.ts'
import { Jsr } from '@/lib/jsr.ts'
import cliDenoJson from '../deno.json' with { type: 'json' }
import { compare } from '@std/semver/compare'
import { parse } from '@std/semver/parse'
import invariant from 'tiny-invariant'
import type { Generator } from '@/types/generator.ts'
import { ProjectLoadError, type UnloadedProject } from '@/lib/project-load-error.ts'
import { offerConfigMigrations } from '@/lib/config-migration-offer.ts'

type CreateProjectArgs = {
  name: string
  basePath: string
  generators: string[]
  availableGenerators: Generator[]
}

export class SkmtcRoot {
  projects: Project[]
  manager: Manager
  /**
   * Projects that failed to open. A command fails only when it names one
   * of them; the others still run (#374).
   */
  unloadedProjects: UnloadedProject[]

  constructor(projects: Project[], manager: Manager, unloadedProjects: UnloadedProject[] = []) {
    this.projects = projects
    this.manager = manager
    this.unloadedProjects = unloadedProjects
  }

  /** Every project folder's name, including the ones that did not load. */
  toProjectNames(): string[] {
    return [
      ...this.projects.map(({ name }) => name),
      ...this.unloadedProjects.map(({ name }) => name)
    ]
  }

  static toPath() {
    return toRootPath()
  }

  static async checkRootExists(path: string): Promise<boolean> {
    return await exists(path, { isDirectory: true })
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

  /**
   * The project with this name, `undefined` when no folder has it. Throws
   * {@link ProjectLoadError} when the folder exists but did not load, so a
   * command reports the load error rather than "not found".
   */
  lookupProject(projectName: string): Project | undefined {
    const unloaded = this.unloadedProjects.find(({ name }) => name === projectName)

    if (unloaded !== undefined) {
      throw new ProjectLoadError(unloaded)
    }

    return this.projects.find(({ name }) => name === projectName)
  }

  findProject(projectName: string): Project {
    const project = this.lookupProject(projectName)

    invariant(project, `Project "${projectName}" not found`)

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

    // `Project.create` already adds the project to `projects`: the Ink tasks
    // call it directly.

    await this.manager.cleanup()

    return project
  }

  static async open(manager: Manager) {
    const rootPath = SkmtcRoot.toPath()

    const hasRoot = await SkmtcRoot.checkRootExists(rootPath)

    if (!hasRoot) {
      return new SkmtcRoot([], manager)
    }

    const projectDirs = Array.from(Deno.readDirSync(rootPath)).filter(item => {
      return item.isDirectory && !item.name.startsWith('@')
    })

    // Before the projects are read, so a project migrated here is read on its new names.
    await offerConfigMigrations({ projectNames: projectDirs.map(projectDir => projectDir.name) })

    const opened = await Promise.allSettled(
      projectDirs.map(projectDir => Project.open(projectDir.name, manager))
    )

    const projects = opened.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []))
    const unloadedProjects = opened.flatMap((result, index) =>
      result.status === 'rejected' ? [{ name: projectDirs[index].name, error: result.reason }] : []
    )

    // stderr, so a strict-mode command's stdout stays one JSON document.
    unloadedProjects.forEach(unloaded =>
      console.error(`Warning: ${new ProjectLoadError(unloaded).message}`)
    )

    return new SkmtcRoot(projects, manager, unloadedProjects)
  }
}
