import type { Stringable } from '@skmtc/core'

/**
 * Structural check for {@link Stringable} — shared by the value-protocol
 * guards ({@link import('./KtConstructed.ts').isKtConstructed},
 * {@link import('./KtSupertyped.ts').isKtSupertyped}). Weak by nature —
 * every object has a `toString` — but that is the structural reality of
 * `Stringable`; the protocols' field names carry the real signal.
 */
export const isStringable = (item: unknown): item is Stringable => {
  if (typeof item === 'string') {
    return true
  }

  return typeof item === 'object' && item !== null && typeof item.toString === 'function'
}
