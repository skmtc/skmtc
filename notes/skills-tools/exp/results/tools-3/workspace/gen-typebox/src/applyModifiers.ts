import { withOptional } from './withOptional.ts'
import { withNullable } from './withNullable.ts'
import type { Modifiers } from '@skmtc/core'

export const applyModifiers = (content: string, modifiers: Modifiers) => {
  const postNullable = withNullable(content, modifiers)

  const postOptional = withOptional(postNullable, modifiers)

  return postOptional.toString()
}
