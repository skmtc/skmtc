import { join } from 'jsr:@std/path@^1.0.6'
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
