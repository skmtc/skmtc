import { join } from '@std/path/join'
type ToResolvedArtifactPathArgs = {
  basePath: string | undefined
  destinationPath: string
}

export const toResolvedArtifactPath = ({
  basePath,
  destinationPath
}: ToResolvedArtifactPathArgs): string => {
  return join(basePath ?? './', destinationPath.replace(/^@\//, ''))
}
