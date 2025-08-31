import { join } from '@std/path/join'
type ToResolvedArtifactPathArgs = {
  basePath: string | undefined
  destinationPath: string
}

export const toResolvedArtifactPath = ({
  basePath,
  destinationPath
}: ToResolvedArtifactPathArgs) => {
  return join(basePath ?? './', destinationPath.replace(/^@\//, ''))
}
