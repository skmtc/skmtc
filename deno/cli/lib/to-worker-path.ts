import { join } from '@std/path/join'

export const toWorkerPath = (projectPath: string) => {
  return `file://${join(projectPath, 'worker.ts')}`
}
