import { capitalize } from '@/helpers/strings.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'

/**
 * Suffix a base identifier name with a variant name.
 *
 * For the canonical `'main'` variant, returns the base name unchanged —
 * variants-aware generators stay name-compatible with variants-unaware
 * callers for the common single-variant case.
 *
 * For any other variant, splits on `-` (kebab-case segments — see
 * {@link variantNameRegex}), PascalCases each segment, and appends.
 * The kebab → PascalCase transform is invertible because the variant
 * regex bans uppercase, so `'line-items'` is the only valid input that
 * yields `'LineItems'`.
 *
 * @example
 *   withVariant('EditQuotesForm', 'main')         // → 'EditQuotesForm'
 *   withVariant('EditQuotesForm', 'description')  // → 'EditQuotesFormDescription'
 *   withVariant('EditQuotesForm', 'line-items')   // → 'EditQuotesFormLineItems'
 */
export const withVariant = (baseName: string, variant: string): string => {
  if (variant === DEFAULT_VARIANT) {
    return baseName
  }

  const suffix = variant.split('-').map(capitalize).join('')

  return `${baseName}${suffix}`
}
