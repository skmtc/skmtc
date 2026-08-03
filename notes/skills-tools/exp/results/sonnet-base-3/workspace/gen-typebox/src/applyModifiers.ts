import { withOptional } from './withOptional.ts'
import { withNullable } from './withNullable.ts'
import type { Modifiers } from 'jsr:@skmtc/core@0.28.3'

export const applyModifiers = (content: string, modifiers: Modifiers) => {
  const postNullable = withNullable(content, modifiers)

  const postOptional = withOptional(postNullable, modifiers)

  return postOptional.toString()
}
