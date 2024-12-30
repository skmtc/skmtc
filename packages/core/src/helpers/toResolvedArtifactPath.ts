import "../_dnt.polyfills.js";
import { join } from '../deps/jsr.io/@std/path/1.0.6/mod.js'
type ToResolvedArtifactPathArgs = {
  basePath: string | undefined
  destinationPath: string
}

export const toResolvedArtifactPath = ({
  basePath,
  destinationPath
}: ToResolvedArtifactPathArgs) => {
  return join(basePath ?? 'dist', destinationPath.replace(/^@\//, ''))
}
