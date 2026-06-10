import type { Stringable } from '@skmtc/core'

/**
 * Arguments for {@link withDescription}.
 */
export type WithDescriptionArgs = {
  /** Optional description text for the KDoc comment. */
  description?: string
}

/**
 * Wraps a value with a KDoc comment when a description is provided —
 * Kotlin's block-comment syntax is identical to JSDoc, so this mirrors
 * the lang-typescript helper byte-for-byte.
 */
export const withDescription = (value: Stringable, { description }: WithDescriptionArgs): string => {
  return description ? `/** ${description} */\n${value}` : `${value}`
}
