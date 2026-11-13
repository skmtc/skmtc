import { assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import { parseEnrichmentUmbrella } from './parseEnrichmentUmbrella.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import { toEnrichmentsContext } from '@/test/toEnrichmentsContext.ts'

const formSchema = v.object({
  subject: v.optional(
    v.object({
      title: v.optional(v.string()),
      submitLabel: v.optional(v.string())
    })
  ),
  generator: v.optional(v.object({ basePackage: v.optional(v.string()) })),
  stack: v.optional(v.object({ theme: v.optional(v.string()) }))
})

const GENERATOR_ID = '@test/gen-form'

const parseFor = (settings: unknown) => {
  const context = toEnrichmentsContext(settings)
  const parsed = parseEnrichmentUmbrella({
    context,
    generatorId: GENERATOR_ID,
    subjectSegments: ['/pets', 'post', 'main'],
    schema: formSchema
  })
  return { context, parsed }
}

Deno.test('parseEnrichmentUmbrella - valid config parses and emits no warnings', () => {
  const { context, parsed } = parseFor({
    enrichments: {
      [GENERATOR_ID]: {
        '/pets': { post: { main: { title: 'New Pet', submitLabel: 'Create' } } }
      }
    }
  })

  assertEquals(parsed.subject, { title: 'New Pet', submitLabel: 'Create' })
  assertEquals(context.warnings, [])
})

Deno.test('parseEnrichmentUmbrella - misspelled optional subject key warns with the full routing path', () => {
  const { context, parsed } = parseFor({
    enrichments: {
      [GENERATOR_ID]: {
        '/pets': { post: { main: { submitLabl: 'Create' } } }
      }
    }
  })

  // The key was dropped by the parse — the generator sees the default.
  assertEquals(parsed.subject, {})

  assertEquals(context.warnings.length, 1)
  const [warning] = context.warnings
  assertEquals(warning.type, 'UNKNOWN_ENRICHMENT_KEY')
  assertEquals(warning.level, 'warning')
  assertEquals(warning.path, [GENERATOR_ID, '/pets', 'post', 'main', 'submitLabl'])
  assertEquals(warning.suggestion, 'submitLabel')
  assertEquals(
    warning.message,
    `unknown enrichment key 'submitLabl' at ` +
      `'${GENERATOR_ID} → /pets → post → main' — ignored (did you mean 'submitLabel'?)`
  )
})

Deno.test('parseEnrichmentUmbrella - unknown generator-scope key warns under _generator', () => {
  const { context } = parseFor({
    enrichments: {
      [GENERATOR_ID]: {
        _generator: { basePackge: 'com.example' }
      }
    }
  })

  assertEquals(context.warnings.length, 1)
  assertEquals(context.warnings[0].path, [GENERATOR_ID, '_generator', 'basePackge'])
  assertEquals(context.warnings[0].suggestion, 'basePackage')
})

Deno.test('parseEnrichmentUmbrella - stack scope is exempt from unknown-key detection', () => {
  // The stack leaf is a shared bag: each generator declares only the
  // fields it reads, so keys owned by other generators must not warn.
  const { context } = parseFor({
    enrichments: {
      _stack: { theme: 'dark', someOtherGeneratorsField: true }
    }
  })

  assertEquals(context.warnings, [])
})

const FIX_LINE = `Enrichments for '${GENERATOR_ID}' do not match its enrichment schema. Fix them in client.json (settings.enrichments):`

Deno.test('parseEnrichmentUmbrella - a wrong-typed value throws, naming its place in client.json', () => {
  assertThrows(
    () =>
      parseFor({
        enrichments: {
          [GENERATOR_ID]: {
            '/pets': { post: { main: { title: 123 } } }
          }
        }
      }),
    Error,
    `${FIX_LINE}\n- '${GENERATOR_ID} → /pets → post → main → title': Invalid type: Expected string but received 123`
  )
})

Deno.test('parseEnrichmentUmbrella - every wrong value is listed, not only the first', () => {
  const error = assertThrows(() =>
    parseFor({
      enrichments: {
        [GENERATOR_ID]: {
          '/pets': { post: { main: { title: 123, submitLabel: false } } }
        }
      }
    })
  )

  assertEquals(
    error instanceof Error ? error.message : undefined,
    [
      FIX_LINE,
      `- '${GENERATOR_ID} → /pets → post → main → title': Invalid type: Expected string but received 123`,
      `- '${GENERATOR_ID} → /pets → post → main → submitLabel': Invalid type: Expected string but received false`
    ].join('\n')
  )
})

Deno.test('parseEnrichmentUmbrella - a value where the generator reads none says to remove it', () => {
  const context = toEnrichmentsContext({
    enrichments: { [GENERATOR_ID]: { '/pets': { post: { main: { title: 'New Pet' } } } } }
  })

  assertThrows(
    () =>
      parseEnrichmentUmbrella({
        context,
        generatorId: GENERATOR_ID,
        subjectSegments: ['/pets', 'post', 'main'],
        schema: emptyEnrichmentSchema
      }),
    Error,
    `- '${GENERATOR_ID} → /pets → post → main': '${GENERATOR_ID}' reads no enrichments here. Remove the value.`
  )
})

Deno.test('parseEnrichmentUmbrella - wrong run-constant values name _generator and _stack', () => {
  const error = assertThrows(() =>
    parseFor({
      enrichments: {
        [GENERATOR_ID]: { _generator: { basePackage: 5 } },
        _stack: { theme: 1 }
      }
    })
  )

  assertEquals(
    error instanceof Error ? error.message : undefined,
    [
      FIX_LINE,
      `- '${GENERATOR_ID} → _generator → basePackage': Invalid type: Expected string but received 5`,
      `- '_stack → theme': Invalid type: Expected string but received 1`
    ].join('\n')
  )
})

Deno.test('parseEnrichmentUmbrella - empty schema with no config parses to the all-undefined umbrella', () => {
  const context = toEnrichmentsContext(undefined)
  const parsed = parseEnrichmentUmbrella({
    context,
    generatorId: GENERATOR_ID,
    subjectSegments: ['/pets', 'post', 'main'],
    schema: emptyEnrichmentSchema
  })

  assertEquals(parsed, { subject: undefined, generator: undefined, stack: undefined })
  assertEquals(context.warnings, [])
})
