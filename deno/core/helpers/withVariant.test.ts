import { assertEquals } from '@std/assert'
import { withVariant } from '@/helpers/withVariant.ts'

Deno.test('withVariant returns base name unchanged for the main variant', () => {
  assertEquals(withVariant('EditQuotesForm', 'main'), 'EditQuotesForm')
})

Deno.test('withVariant capitalizes a single-segment variant name', () => {
  assertEquals(withVariant('EditQuotesForm', 'description'), 'EditQuotesFormDescription')
})

Deno.test('withVariant PascalCases each segment of a kebab-cased variant', () => {
  assertEquals(withVariant('EditQuotesForm', 'line-items'), 'EditQuotesFormLineItems')
})

Deno.test('withVariant handles multi-hyphen variant names', () => {
  assertEquals(withVariant('Form', 'customer-data-v2'), 'FormCustomerDataV2')
})

Deno.test('withVariant preserves the base name verbatim (no transform)', () => {
  // baseName is treated as opaque — withVariant must not mutate casing.
  assertEquals(withVariant('aLowercaseBase', 'description'), 'aLowercaseBaseDescription')
})
