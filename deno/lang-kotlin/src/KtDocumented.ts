/**
 * The protocol by which a Definition's VALUE supplies a KDoc description
 * to {@link import('./KtDefinition.ts').KtDefinition} — a value-carried
 * protocol (like `KtAnnotated`) because it renders ABOVE the head+value
 * line and the neutral `Lang.toDefinition` call the Drivers make carries
 * no description; threading it through core would change every
 * language's output at once. The lang renders the KDoc; WHAT the text is
 * (a schema `description`, an operation `summary`) is generator policy.
 *
 * An explicit `description` passed to `KtDefinition`'s constructor wins
 * over the protocol.
 */
export type KtDocumented = {
  description?: string
}

/**
 * Type guard for the {@link KtDocumented} protocol — narrows without casts.
 */
export const isKtDocumented = (value: unknown): value is KtDocumented => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return 'description' in value && typeof value.description === 'string'
}
