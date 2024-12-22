import type { StackTrail } from '../context/StackTrail.ts'

export const tracer = <T>(
  stackTrail: StackTrail,
  token: string | string[],
  fn: () => T
) => {
  stackTrail.append(token)

  const result = fn()

  stackTrail.remove(token)

  return result
}
