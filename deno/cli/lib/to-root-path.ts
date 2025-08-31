import { join } from '@std/path/join'

export const toRootPath = () => {
  return join(Deno.cwd(), '.skmtc')
}
