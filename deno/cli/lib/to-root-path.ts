import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import { homedir } from 'node:os'
import { resolve } from '@std/path/resolve'
import { relative } from '@std/path/relative'

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

  return resolvedPath.startsWith(resoledHomedir) && resolvedPath !== resoledHomedir
}

export const toRelativeRootPath = () => {
  const homePath = Deno.env.get('HOME')

  const appRootPath = join(toRootPath(), '..')

  if (!homePath) {
    return appRootPath
  }

  const relativePath = relative(homePath, appRootPath)

  return join('~', relativePath)
}
