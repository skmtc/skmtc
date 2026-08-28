import { toRefName } from '@/helpers/refFns.ts'

/**
 * Every component name a JSON-Schema-shaped value refers to through a
 * `$ref`, at any depth. Used on an IR node's unresolved
 * `toJsonSchema({ resolve: false })` output, where references are still
 * `{ $ref }` objects.
 */
export const collectRefNames = (value: unknown, found: Set<string> = new Set()): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRefNames(item, found)
    }

    return [...found]
  }

  if (value === null || typeof value !== 'object') {
    return [...found]
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string') {
      found.add(toRefName(child))
    } else {
      collectRefNames(child, found)
    }
  }

  return [...found]
}
