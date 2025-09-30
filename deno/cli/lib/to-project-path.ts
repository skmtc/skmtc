import { resolve } from '@std/path/resolve'
import { toRootPath } from '@/lib/to-root-path.ts'

export const toProjectPath = (projectName: string) => {
  const rootPath = toRootPath()

  return resolve(rootPath, projectName)
}
