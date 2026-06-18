/**
 * The protocol by which a Definition's VALUE supplies an XML-doc
 * description to {@link import('./CsDefinition.ts').CsDefinition} — the
 * `KtDocumented` analog, for the same reason: the neutral
 * `Lang.toDefinition` call the Drivers make carries no description, and
 * threading it through core would change every language's output at
 * once. The lang renders the `/// <summary>` block (XML-escaped, via
 * {@link import('./withDescription.ts').withDescription}); WHAT the text
 * is (a schema `description`, an operation `summary`) is generator
 * policy.
 *
 * An explicit `description` passed to `CsDefinition`'s constructor wins
 * over the protocol. Remember the spec-28 gotcha: the Driver wraps the
 * PROJECTION, so the projection must mirror the field as a getter.
 */
export type CsDocumented = {
  description?: string
}

/**
 * Type guard for the {@link CsDocumented} protocol — narrows without casts.
 */
export const isCsDocumented = (value: unknown): value is CsDocumented => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return 'description' in value && typeof value.description === 'string'
}
