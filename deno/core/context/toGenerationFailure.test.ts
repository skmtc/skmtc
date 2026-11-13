import { assertEquals } from '@std/assert'
import { toGenerationFailure } from '@/context/toGenerationFailure.ts'

Deno.test('toGenerationFailure - one failed subject: its message, then its trail', () => {
  assertEquals(
    toGenerationFailure([{ trail: 'run:generate:gen-a:/pets:get', message: 'Boom' }]),
    'Generation failed for 1 subject(s):\nBoom\n  in run:generate:gen-a:/pets:get'
  )
})

Deno.test('toGenerationFailure - one message for subjects that failed the same way', () => {
  const failedItems = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(name => ({
    trail: `run:generate:gen-a:${name}`,
    message: 'Enrichments for gen-a do not match'
  }))

  assertEquals(
    toGenerationFailure([...failedItems, { trail: 'run:generate:gen-b:X', message: 'Other' }]),
    [
      'Generation failed for 8 subject(s):',
      'Enrichments for gen-a do not match',
      '  in run:generate:gen-a:A',
      '  in run:generate:gen-a:B',
      '  in run:generate:gen-a:C',
      '  in run:generate:gen-a:D',
      '  in run:generate:gen-a:E',
      '  and 2 more',
      '',
      'Other',
      '  in run:generate:gen-b:X'
    ].join('\n')
  )
})
