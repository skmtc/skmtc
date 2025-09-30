import { resolve } from '@std/path/resolve'
import { toRootPath } from '@/lib/to-root-path.ts'
import type { ProjectKey } from '@/lib/project.ts'

export const toRemoteProjectPath = (projectKey: ProjectKey) => {
  const rootPath = toRootPath()
  const [accountName, projectName] = projectKey.split('/')

  return resolve(rootPath, accountName, projectName)
}
