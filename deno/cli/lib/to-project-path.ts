import { resolve } from '@std/path'

export const toProjectPath = (projectName: string) => {
  return resolve(Deno.cwd(), '.skmtc', projectName)
}
