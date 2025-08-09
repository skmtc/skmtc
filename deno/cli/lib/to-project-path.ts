import { join } from '@std/path'

export const toProjectPath = (projectName: string) => {
  return join(Deno.cwd(), '.skmtc', projectName)
}
