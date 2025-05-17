import { withDescription } from '@skmtc/core'
import { withOptional } from './withOptional.ts'
import { withNullable } from './withNullable.ts'
import type { Modifiers } from '@skmtc/core'

export const applyModifiers = (content: string, modifiers: Modifiers) => {
  const postNullable = withNullable(content, modifiers)

  const postDescription = withDescription(postNullable, modifiers)

  const postOptional = withOptional(postDescription, modifiers)

  return postOptional.toString()
}
