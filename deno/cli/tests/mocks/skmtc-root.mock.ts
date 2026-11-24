import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Manager } from '@/lib/manager.ts'
import type { Project } from '@/lib/project.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'

type MockSkmtcRootOptions = {
  projects?: Project[]
}

/**
 * A real `SkmtcRoot` over mock projects. Only the two methods that touch
 * the file system or the network are replaced.
 */
export function createMockSkmtcRoot(
  manager: Manager,
  options: MockSkmtcRootOptions = {}
): SkmtcRoot {
  const {
    projects = [
      createMockProject(manager, { name: 'project-1' }),
      createMockProject(manager, { name: 'project-2' })
    ]
  } = options

  const skmtcRoot = new SkmtcRoot(projects, manager)

  skmtcRoot.createProject = async ({ name, generators }) => {
    const newProject = createMockProject(manager, { name, generators })
    projects.push(newProject)
    return await Promise.resolve(newProject)
  }
  skmtcRoot.upgradeCheck = async () => {}

  return skmtcRoot
}
