import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'
import type { ClientSettings } from '@/types/Settings.ts'

// `not` fails a schema under the default (`strict`) and parses under `not: unknown`.
const document = toDocumentObject(
  {
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    paths: {},
    components: { schemas: { AnythingButAString: { not: { type: 'string' } } } }
  },
  'parse settings document'
)

const run = (settings: ClientSettings) => {
  const result = toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: document },
    settings,
    toGeneratorConfigMap: () => ({}),
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['TEST'])
  })

  return {
    notErrors: result.manifest.parseIssues.filter(issue => issue.level === 'error').length,
    bothSetWarnings: result.logs.filter(
      line => line.level === 'WARN' && line.message.includes('settings.parse and settings.system are both set')
    ).length
  }
}

Deno.test('toArtifacts - settings.parse alone is read, with no warning', () => {
  assertEquals(run({ parse: { not: 'unknown' } }), { notErrors: 0, bothSetWarnings: 0 })
})

Deno.test('toArtifacts - settings.system alone is read, as before, with no warning', () => {
  assertEquals(run({ system: { not: 'unknown' } }), { notErrors: 0, bothSetWarnings: 0 })
})

Deno.test('toArtifacts - with settings.parse and settings.system, parse wins and one warning is logged', () => {
  // `system` asks for `strict`: had it won, the schema would fail.
  assertEquals(run({ parse: { not: 'unknown' }, system: { not: 'strict' } }), { notErrors: 0, bothSetWarnings: 1 })
  // And the other way round: `parse` asks for `strict` and wins.
  assertEquals(run({ parse: { not: 'strict' }, system: { not: 'unknown' } }), { notErrors: 1, bothSetWarnings: 1 })
})

Deno.test('toArtifacts - with neither set, the default (strict) holds', () => {
  assertEquals(run({}), { notErrors: 1, bothSetWarnings: 0 })
})
