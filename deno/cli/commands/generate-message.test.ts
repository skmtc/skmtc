import { assertEquals } from '@std/assert/equals'
import { toGenerateMessage } from '@/commands/generate.tsx'

const stats = { lines: 200, totalTime: 180, errors: [], files: 7 }

Deno.test('toGenerateMessage - names no token count when the tokens were not counted', () => {
  assertEquals(toGenerateMessage(stats), { success: 'Generated 7 files in 180ms.' })
})

Deno.test('toGenerateMessage - names the token count when it was counted', () => {
  assertEquals(toGenerateMessage({ ...stats, tokens: 1234 }), {
    success: 'Generated 1,234 tokens, 7 files in 180ms.'
  })
})
