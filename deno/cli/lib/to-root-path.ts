import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import { homedir } from 'node:os'
import { resolve } from '@std/path/resolve'

export const toRootPath = () => {
  let path = Deno.cwd()

  while (isInsideHomedir(path)) {
    if (hasDotSkmtc(path)) {
      return join(path, '.skmtc')
    }

    path = join(path, '..')
  }

  return join(Deno.cwd(), '.skmtc')
}

const hasDotSkmtc = (path: string) => {
  const result = existsSync(join(path, '.skmtc'))

  return result
}

const isInsideHomedir = (path: string) => {
  const resoledHomedir = resolve(homedir())

  const resolvedPath = resolve(path)

  return resolvedPath.startsWith(resoledHomedir)
}
