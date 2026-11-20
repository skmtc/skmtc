import { assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// skmtc/skmtc#364. `P1` and `P2` are a loop of `$ref`s, so `/a`'s parameter
// names no component. Each step of the loop names a component, so the parser
// kept it, and `toEffectiveParameters()` threw `Max lookups reached` while it
// keyed the parameter. That throw failed the run: no artifacts at all, not
// even for `/b`, which has no loop.

const document = toDocumentObject(
  {
    openapi: '3.1.0',
    info: { title: 'Loop', version: '1' },
    paths: {
      '/a': { get: { parameters: [{ $ref: '#/components/parameters/P1' }], responses: { '200': { description: 'ok' } } } },
      '/b': { get: { responses: { '200': { description: 'ok' } } } }
    },
    components: {
      parameters: {
        P1: { $ref: '#/components/parameters/P2' },
        P2: { $ref: '#/components/parameters/P1' }
      }
    }
  },
  'parameter loop document'
)

/** Runs a generator that reads each operation's parameters, as gen-md-docs does. */
const run = (settings: ClientSettings | undefined) => {
  const seen: string[] = []

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    parameters: toOasOperationEntry({
      id: 'parameters',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ operation }) => {
        const parameters = operation.toEffectiveParameters().map(parameter => {
          try {
            return parameter.resolve().name
          } catch (error) {
            if (DanglingRefError.is(error)) {
              return `${parameter.isRef() ? parameter.$ref : parameter.name} (unresolved)`
            }

            throw error
          }
        })

        seen.push(`${operation.method} ${operation.path}: ${parameters.join(', ')}`)
      }
    })
  })

  const result = toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: document },
    settings,
    toGeneratorConfigMap: generators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail([])
  })

  return { seen, issues: result.manifest.parseIssues.map(({ level, type }) => `${level} ${type}`) }
}

Deno.test('toArtifacts - a loop of parameter $refs removes the operation that uses it, and the run goes on', () => {
  const { seen, issues } = run(undefined)

  assertEquals(seen, ['get /b: '])
  assertEquals(issues, ['error DANGLING_REF', 'error INVALID_DEPENDENCY_REF', 'error INVALID_DEPENDENCY_REF'])
})

Deno.test("toArtifacts - system.danglingRefs ['parameter']: a loop of parameter $refs reaches the generator as a ref that names nothing", () => {
  const { seen, issues } = run({ system: { danglingRefs: ['parameter'] } })

  assertEquals(seen, ['get /a: #/components/parameters/P1 (unresolved)', 'get /b: '])
  assertEquals(issues, ['warning DANGLING_REF', 'warning DANGLING_REF'])
})
