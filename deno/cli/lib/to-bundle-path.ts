import { join } from '@std/path/join'

export const toBundlePath = (projectPath: string) => {
  return `file://${join(projectPath, 'bundle.js')}`
}
