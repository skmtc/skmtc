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

Deno.test('toGenerateMessageString - leaves out debug parse issues', () => {
  const message = toGenerateMessageString({
    stats: baseStats,
    parseIssues: [
      {
        protocol: 'oas',
        level: 'warning',
        type: 'WILDCARD_MEDIA_TYPE',
        location: '/users:get:responses:200:content',
        message: 'read from */*'
      },
      {
        protocol: 'oas',
        level: 'debug',
        type: 'NO_JSON_MEDIA_TYPE',
        location: '/files:get:responses:200:content',
        message: 'no lookup reads it'
      }
    ]
  })

  assertStringIncludes(message, 'Parse issues (1):')
  assertStringIncludes(message, 'WILDCARD_MEDIA_TYPE')
  assertEquals(message.includes('NO_JSON_MEDIA_TYPE'), false)
})

Deno.test('toGenerateMessageString - no parse issue section when all are debug', () => {
  const message = toGenerateMessageString({
    stats: baseStats,
    parseIssues: [
      {
        protocol: 'oas',
        level: 'debug',
        type: 'NO_JSON_MEDIA_TYPE',
        location: '/files:get:responses:200:content',
        message: 'no lookup reads it'
      }
    ]
  })

  assertEquals(message, 'Generated 1,234 tokens, 7 files in 180ms.')
})
