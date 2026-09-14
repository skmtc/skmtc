/**
 * The veneer forwards a projection's caller options type: what a generator
 * declares as the second type argument reaches the identity statics and
 * `this.options` typed, the same as on core's factory. Mostly a compile-time
 * check — a veneer that dropped the parameter would fail `deno check` here.
 */
import { assertEquals } from '@std/assert'
import { emptyEnrichmentSchema, toRefName } from '@skmtc/core'
import type { Enrichments } from '@skmtc/core'
import { toTsModelProjectionBase } from './toTsModelProjectionBase.ts'

type PetOptions = { suffix: string }

const PetBase = toTsModelProjectionBase<Enrichments, PetOptions>({
  id: '@test/pet',
  toIdentifierName: ({ refName, options }) => `${refName}${options.suffix}`,
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ refName, options }) => `@/models/${refName}${options.suffix}.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PetModel extends PetBase {
  override toString(): string {
    return `{ kind: '${this.options.suffix}' }`
  }
}

Deno.test('toTsModelProjectionBase forwards the options type to the identity statics', () => {
  const refName = toRefName('#/components/schemas/Pet')
  const enrichments = {
    subject: undefined,
    generator: undefined,
    stack: undefined
  }

  assertEquals(
    PetModel.toIdentifierName({
      refName,
      enrichments,
      variant: 'main',
      options: { suffix: 'Input' }
    }),
    'PetInput'
  )
  assertEquals(
    PetModel.toExportPath({
      refName,
      enrichments,
      variant: 'main',
      options: { suffix: 'Input' }
    }),
    '@/models/PetInput.ts'
  )
})
