/**
 * The veneer forwards a projection's caller options type: what a generator
 * declares as the second type argument reaches the identity statics and
 * `this.options` typed, the same as on core's factory. Mostly a compile-time
 * check — a veneer that dropped the parameter would fail `deno check` here.
 */
import { assertEquals } from '@std/assert'
import { emptyEnrichmentSchema, toSchemaComponentRef, type RefName } from '@skmtc/core'
import type { Enrichments } from '@skmtc/core'
import { toTsModelProjectionBase } from './toTsModelProjectionBase.ts'

type PetOptions = { suffix: string }

const PetBase = toTsModelProjectionBase<Enrichments, PetOptions>({
  id: '@test/pet',
  toIdentifierName: ({ ref, options }) => `${ref.refName}${options.suffix}`,
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ ref, options }) => `@/models/${ref.refName}${options.suffix}.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PetModel extends PetBase {
  override toString(): string {
    return `{ kind: '${this.options.suffix}' }`
  }
}

Deno.test('toTsModelProjectionBase forwards the options type to the identity statics', () => {
  const ref = toSchemaComponentRef('Pet' as RefName)
  const enrichments = {
    subject: undefined,
    generator: undefined,
    stack: undefined
  }

  assertEquals(
    PetModel.toIdentifierName({
      ref,
      enrichments,
      variant: 'main',
      options: { suffix: 'Input' }
    }),
    'PetInput'
  )
  assertEquals(
    PetModel.toExportPath({
      ref,
      enrichments,
      variant: 'main',
      options: { suffix: 'Input' }
    }),
    '@/models/PetInput.ts'
  )
})
