import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { genMapResultSchema, matchOutcomeSchema } from './wire.ts'

// These pin the CONSUMER-leniency decisions that live on the wire schemas —
// the desktop parses responses with these exact schemas, so a change here is
// a compatibility decision, not an implementation detail.

const fitsOutcome = {
  type: 'fits',
  fieldType: 'string',
  fits: [{ exportName: 'StringField', exportPath: '@/fields/StringField' }],
  misfits: [
    {
      exportName: 'NumberField',
      exportPath: '@/fields/NumberField',
      reason: {
        code: 2322,
        headline: `Type 'X' is not assignable to type 'Y'.`,
        reasons: [`Type 'string' is not assignable to type 'number'.`]
      }
    }
  ],
  unresolved: []
}

describe('matchOutcomeSchema', () => {
  it('parses every outcome variant', () => {
    expect(v.is(matchOutcomeSchema, fitsOutcome)).toBe(true)
    expect(
      v.is(matchOutcomeSchema, {
        type: 'path-broken',
        modelName: 'M',
        brokenAt: { index: 1, segment: 'name' }
      })
    ).toBe(true)
    expect(
      v.is(matchOutcomeSchema, { type: 'model-missing', modelName: null, detail: 'gone' })
    ).toBe(true)
    expect(v.is(matchOutcomeSchema, { type: 'unavailable', reason: 'no schema' })).toBe(true)
  })

  it('rejects an unknown outcome type', () => {
    expect(v.is(matchOutcomeSchema, { type: 'nope' })).toBe(false)
  })

  it('degrades a malformed misfit reason to absent, never failing the parse', () => {
    // The reason is decoration: `reason: null` (sloppy serializer) or future
    // shape drift must leave the misfit verdict usable.
    const withNullReason = {
      ...fitsOutcome,
      misfits: [{ exportName: 'NumberField', exportPath: '@/fields/NumberField', reason: null }]
    }
    const parsed = v.parse(matchOutcomeSchema, withNullReason)
    if (parsed.type !== 'fits') throw new Error('expected fits')
    expect(parsed.misfits[0].reason).toBeUndefined()
  })
})

describe('genMapResultSchema', () => {
  const entry = {
    artifactPath: 'src/schemas/Pet.ts',
    artifactSpan: [0, 10],
    projectionName: 'petSchema',
    producerName: 'ZodObject',
    generatorRef: '@acme/gen-zod',
    schemaPointer: '#/components/schemas/Pet',
    variant: 'main'
  }

  it('parses the response shape', () => {
    expect(v.is(genMapResultSchema, { entries: [entry], staleFiles: [] })).toBe(true)
  })

  it('rejects a too-short span', () => {
    expect(
      v.is(genMapResultSchema, { entries: [{ ...entry, artifactSpan: [0] }], staleFiles: [] })
    ).toBe(false)
  })

  it('tolerates extra span items, keeping the first two (deliberate leniency)', () => {
    // A future plugin appending span metadata must not break older desktops.
    const parsed = v.parse(genMapResultSchema, {
      entries: [{ ...entry, artifactSpan: [0, 5, 99] }],
      staleFiles: []
    })
    expect(parsed.entries[0].artifactSpan).toEqual([0, 5])
  })
})
