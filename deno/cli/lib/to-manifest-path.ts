import { join } from '@std/path/join'

export const toManifestPath = (projectPath: string) => {
  return join(projectPath, '.settings', 'manifest.json')
}
