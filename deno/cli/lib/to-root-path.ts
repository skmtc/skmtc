import { join } from '@std/path'

export const toRootPath = () => {
  return join(Deno.cwd(), '.apifoundry')
}
