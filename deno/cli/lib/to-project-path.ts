import { resolve } from '@std/path/resolve'
import { dirname } from '@std/path/dirname'
import { basename } from '@std/path/basename'
import { existsSync } from '@std/fs/exists'
import { toRootPath } from '@/lib/to-root-path.ts'

export const toProjectPath = (projectName: string) => {
  const rootPath = toRootPath()

  return resolve(rootPath, projectName)
}

/**
 * Whether `projectName` names a project directory directly under the
 * root — the entries `SkmtcRoot` lists. `.`, `..` and nested paths don't.
 */
export const isProjectName = (projectName: string): boolean => {
  const projectPath = toProjectPath(projectName)
  const name = basename(projectPath)

  return (
    dirname(projectPath) === resolve(toRootPath()) &&
    !name.startsWith('.') &&
    !name.startsWith('@') &&
    existsSync(projectPath, { isDirectory: true })
  )
}
