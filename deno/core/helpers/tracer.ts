import type { Logger } from '@std/log/logger'
import type { StackTrail } from '../context/StackTrail.ts'

export const tracer = <T>(
  stackTrail: StackTrail,
  token: string | string[],
  fn: () => T,
  log: Logger
) => {
  stackTrail.append(token)
  try {
    const result = fn()

    stackTrail.remove(token)

    return result
  } catch (error) {
    log.error(`Error in ${stackTrail}`, error)

    stackTrail.remove(token)

    throw error
  }
}
