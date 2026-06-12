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
 * the lang-typescript helper.
 *
 * A multi-line description renders as a block with ` * ` margins —
 * the inline form would leave continuation lines without a comment
 * margin, so a formatter eats a content-leading `*` as decoration and
 * intra-line indentation is lost.
 */
export const withDescription = (value: Stringable, { description }: WithDescriptionArgs): string => {
  if (!description) {
    return `${value}`
  }

  if (!description.includes('\n')) {
    return `/** ${description} */\n${value}`
  }

  const body = description
    .split('\n')
    .map(line => (line.length ? ` * ${line}` : ' *'))
    .join('\n')

  return `/**\n${body}\n */\n${value}`
}
