import { assertEquals } from '@std/assert'
import { toDocumentString } from '@/context/documentTrail.ts'

Deno.test('toDocumentString strips the run prefix and escapes frames', () => {
  assertEquals(
    toDocumentString(['trace-1', 'span-1', 'parse', 'paths', '/pets:archive', 'get']),
    'paths:/pets%3Aarchive:get'
  )
})

Deno.test('toDocumentString keeps a trail without a phase frame', () => {
  assertEquals(toDocumentString(['paths', '/pets']), 'paths:/pets')
})
