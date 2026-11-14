import type { Stringable } from '@skmtc/core'
import type { Modifiers } from '@skmtc/core'

/**
 * Prepends a value with a multi-line JSDoc comment when a description is
 * provided; returns the value unchanged otherwise. Each line of the
 * description becomes a ` * ` gutter line, so an already-wrapped
 * description renders as multiple comment lines.
 *
 * @example
 * ```typescript
 * withDescription('export const API_URL = "...";', { description: 'Base URL' })
 * // /**
 * //  * Base URL
 * //  *\/
 * // export const API_URL = "...";
 * ```
 */
export const withDescription = (value: Stringable, { description }: Modifiers): string => {
  if (!description) {
    return `${value}`
  }

  // A `*/` in the text would end the comment early and break the file.
  const lines = description
    .replaceAll('*/', '*\\/')
    .split('\n')
    // A blank line gets no trailing space: an editor that trims it on save
    // would otherwise change a generated file.
    .map(line => (line === '' ? ' *' : ` * ${line}`))
    .join('\n')

  return `/**\n${lines}\n */\n${value}`
}
