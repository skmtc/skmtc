import { getDirectoryContents } from './file.ts'
import { toRootPath } from './to-root-path.ts'

export const hasHome = async () => {
  const rootPath = toRootPath()

  const projectContents = await getDirectoryContents(rootPath)

  return Boolean(projectContents)
}
