import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import { homedir } from 'node:os'
import { resolve } from '@std/path/resolve'
import { relative } from '@std/path/relative'
import { readEnv } from '@/lib/env.ts'

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
  // Check if we're in test mode with a mock path
  // @ts-ignore - mock for testing
  if (globalThis.__mockToRelativeRootPath) {
    // @ts-ignore - mock for testing
    return globalThis.__mockToRelativeRootPath
  }

  const homePath = readEnv('HOME')

  const appRootPath = toAbsoluteRootPath()

  if (!homePath) {
    return appRootPath
  }

  const relativePath = relative(homePath, appRootPath)

  return join('~', relativePath)
}

export const toAbsoluteRootPath = () => {
  const appRootPath = join(toRootPath(), '..')

  return appRootPath
}
