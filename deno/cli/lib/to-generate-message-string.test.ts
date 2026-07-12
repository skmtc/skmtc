import { assertEquals, assertStringIncludes } from '@std/assert'
import { toGenerateMessageString } from '@/lib/to-generate-message-string.ts'
import type { GenerationStats } from '@/lib/generationStats.ts'

const baseStats: GenerationStats = {
  tokens: 1234,
  lines: 200,
  totalTime: 180,
  errors: [],
  files: 7
}

Deno.test('toGenerateMessageString - includes basePath in summary when provided', () => {
  const message = toGenerateMessageString({
    stats: baseStats,
    basePath: './web/app/src/generated'
  })

  assertStringIncludes(
    message,
    'Generated 1,234 tokens, 7 files under ./web/app/src/generated in 180ms.'
  )
})

Deno.test('toGenerateMessageString - omits "under …" when basePath is absent', () => {
  const message = toGenerateMessageString({ stats: baseStats })

  assertEquals(message, 'Generated 1,234 tokens, 7 files in 180ms.')
})

Deno.test('toGenerateMessageString - surfaces error count line', () => {
  const message = toGenerateMessageString({
    stats: { ...baseStats, errors: [['a', 'b'], ['c']] }
  })

  assertStringIncludes(message, '2 errors detected')
})
