import { assertEquals } from '@std/assert'
import {
  applyGeneratedSuffix,
  removeGeneratedSuffix,
  DEFAULT_GENERATED_SUFFIX
} from '@/helpers/applyGeneratedSuffix.ts'

Deno.test('applyGeneratedSuffix - inserts before the extension', () => {
  assertEquals(
    applyGeneratedSuffix('@/forms/CreateForm.tsx', DEFAULT_GENERATED_SUFFIX),
    '@/forms/CreateForm.generated.tsx'
  )
  assertEquals(
    applyGeneratedSuffix('@/types/user.ts', DEFAULT_GENERATED_SUFFIX),
    '@/types/user.generated.ts'
  )
})

Deno.test('applyGeneratedSuffix - idempotent on already-suffixed paths', () => {
  assertEquals(
    applyGeneratedSuffix('@/forms/CreateForm.generated.tsx', DEFAULT_GENERATED_SUFFIX),
    '@/forms/CreateForm.generated.tsx'
  )
  assertEquals(
    applyGeneratedSuffix(
      applyGeneratedSuffix('@/types/user.ts', DEFAULT_GENERATED_SUFFIX),
      DEFAULT_GENERATED_SUFFIX
    ),
    '@/types/user.generated.ts'
  )
})

Deno.test('applyGeneratedSuffix - dotted stems keep their dots', () => {
  assertEquals(
    applyGeneratedSuffix('@/types/user.model.tsx', DEFAULT_GENERATED_SUFFIX),
    '@/types/user.model.generated.tsx'
  )
  // Documented rule: multi-part extensions are not special-cased.
  assertEquals(
    applyGeneratedSuffix('@/types/user.d.ts', DEFAULT_GENERATED_SUFFIX),
    '@/types/user.d.generated.ts'
  )
})

Deno.test('applyGeneratedSuffix - no extension appends the suffix', () => {
  assertEquals(applyGeneratedSuffix('@/Makefile', DEFAULT_GENERATED_SUFFIX), '@/Makefile.generated')
  assertEquals(
    applyGeneratedSuffix('@/Makefile.generated', DEFAULT_GENERATED_SUFFIX),
    '@/Makefile.generated'
  )
})

Deno.test('applyGeneratedSuffix - empty suffix disables injection', () => {
  assertEquals(applyGeneratedSuffix('@/forms/CreateForm.tsx', ''), '@/forms/CreateForm.tsx')
})

Deno.test('applyGeneratedSuffix - custom suffix', () => {
  assertEquals(applyGeneratedSuffix('@/types/user.ts', '.gen'), '@/types/user.gen.ts')
  assertEquals(applyGeneratedSuffix('@/types/user.gen.ts', '.gen'), '@/types/user.gen.ts')
})

Deno.test('applyGeneratedSuffix - suffix without a leading dot is dot-normalized', () => {
  assertEquals(applyGeneratedSuffix('@/types/user.ts', 'gen'), '@/types/user.gen.ts')
  // The dot-normalization prevents false positives on stems that merely
  // end with the letters of the suffix.
  assertEquals(applyGeneratedSuffix('@/types/oxygen.ts', 'gen'), '@/types/oxygen.gen.ts')
})

Deno.test('removeGeneratedSuffix - inverse of applyGeneratedSuffix', () => {
  assertEquals(
    removeGeneratedSuffix('@/forms/CreateForm.generated.tsx', DEFAULT_GENERATED_SUFFIX),
    '@/forms/CreateForm.tsx'
  )
  assertEquals(
    removeGeneratedSuffix('@/Makefile.generated', DEFAULT_GENERATED_SUFFIX),
    '@/Makefile'
  )
  // No suffix present → unchanged.
  assertEquals(
    removeGeneratedSuffix('@/forms/CreateForm.tsx', DEFAULT_GENERATED_SUFFIX),
    '@/forms/CreateForm.tsx'
  )
  // Empty suffix (injection disabled) → unchanged.
  assertEquals(removeGeneratedSuffix('@/forms/CreateForm.tsx', ''), '@/forms/CreateForm.tsx')
  // Round-trip.
  assertEquals(
    removeGeneratedSuffix(
      applyGeneratedSuffix('@/types/user.model.tsx', DEFAULT_GENERATED_SUFFIX),
      DEFAULT_GENERATED_SUFFIX
    ),
    '@/types/user.model.tsx'
  )
})
