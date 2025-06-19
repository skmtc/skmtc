import { getDirectoryContents } from './file.ts'
import { getDirectoryNames } from './file.ts'
import { hasSchema } from './file.ts'
import { toRootPath } from './to-root-path.ts'

export const hasGenerators = async () => {
  const rootPath = toRootPath()

  const projectContents = await getDirectoryContents(rootPath)

  const generatorNames = await getDirectoryNames(projectContents, hasSchema)

  return Boolean(generatorNames?.length)
}
