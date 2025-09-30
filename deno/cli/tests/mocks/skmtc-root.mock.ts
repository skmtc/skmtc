import type { SkmtcRoot } from '../../lib/skmtc-root.ts'
import type { Manager } from '../../lib/manager.ts'
import type { Project } from '../../lib/project.ts'
import { createMockProject } from './project.mock.ts'

type MockSkmtcRootOptions = {
  projects?: Project[]
  isLoggedIn?: boolean
}

export function createMockSkmtcRoot(
  manager: Manager,
  options: MockSkmtcRootOptions = {}
): SkmtcRoot {
  const {
    projects = [
      createMockProject(manager, { name: 'project-1' }),
      createMockProject(manager, { name: 'project-2' })
    ],
    isLoggedIn = false
  } = options

  const mockSkmtcRoot: SkmtcRoot = {
    projects,
    manager,
    apiClient: {} as any,
    findProject: (projectName: string) => {
      const project = projects.find(p => p.name === projectName)
      if (!project) {
        throw new Error(`Project "${projectName}" not found`)
      }
      return project
    },
    isLoggedIn,
    login: async () => {},
    logout: async () => {},
    toProject: async ({ projectName }: { projectName: string }) => {
      return mockSkmtcRoot.findProject(projectName)
    },
    createProject: async ({
      name,
      basePath,
      generators
    }: {
      name: string
      basePath: string
      generators: string[]
    }) => {
      const newProject = createMockProject(manager, { name, generators })
      projects.push(newProject)
      return newProject
    },
    createDenoProject: async (serverName: string) => ({
      id: 'server-123',
      serverName,
      latestDeploymentId: null,
      latestDenoDeploymentId: null,
      denoProjectName: serverName,
      latestStatus: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    upgradeCheck: async () => {}
  } as unknown as SkmtcRoot

  return mockSkmtcRoot
}