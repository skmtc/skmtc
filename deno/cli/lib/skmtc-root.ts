import { Project } from './project.ts'
import { join } from '@std/path'
import type { Manager } from './manager.ts'

export class SkmtcRoot {
  projects: Project[]
  manager: Manager

  private constructor(projects: Project[], manager: Manager) {
    this.projects = projects
    this.manager = manager
  }

  static toPath() {
    return join(Deno.cwd(), '.skmtc')
  }

  createProject(projectName: string, manager: Manager) {
    const project = Project.create(projectName, manager)
    this.projects.push(project)

    return project
  }

  static async open(manager: Manager) {
    const projects = await Promise.all(
      Deno.readDirSync(SkmtcRoot.toPath()).map(async post => {
        return await Project.open(post.name, manager)
      })
    )

    return new SkmtcRoot(projects, manager)
  }
}
