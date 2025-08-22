import { resolve } from '@std/path'
import { toRootPath } from './to-root-path.ts'

export const toProjectPath = (projectName: string) => {
  const rootPath = toRootPath()

  return resolve(rootPath, projectName)
}
