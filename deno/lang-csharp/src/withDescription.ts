import type { Stringable } from '@skmtc/core'

/**
 * Arguments for {@link withDescription}.
 */
export type WithDescriptionArgs = {
  /** Optional description text for the XML-doc comment. */
  description?: string
}

/**
 * XML-escapes text destined for an XML-doc block (`&` / `<` / `>`) —
 * shared by {@link withDescription} (declaration-level) and
 * `CsMethodSignature` (member-level). Escaping is grammar (note-30
 * lesson 3): it lives HERE, in the lang, so no gen-side copy exists to
 * drift.
 */
export const escapeXml = (text: string): string => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Wraps a value with an XML-doc `<summary>` block when a description is
 * provided. XML escaping (`&` / `<` / `>`) happens HERE, in the lang —
 * the note-30 lesson 3 baked in from day one: escaping is grammar, so no
 * gen-side copy exists to drift. Multi-line descriptions render one
 * `///` line per input line.
 */
export const withDescription = (
  value: Stringable,
  { description }: WithDescriptionArgs
): string => {
  if (!description) {
    return `${value}`
  }

  const lines = escapeXml(description)
    .split('\n')
    .map(line => `/// ${line}`.trimEnd())
    .join('\n')

  return `/// <summary>\n${lines}\n/// </summary>\n${value}`
}
