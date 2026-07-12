import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as v from 'valibot'
import {
  artifactsResponseSchema,
  candidatesResponseSchema,
  genMapResultSchema,
  matchOutcomeSchema,
  sourceResponseSchema
} from './wire.ts'

// The subpath's core invariant, enforced mechanically: the desktop bundles
// this module into the SPA, so a node builtin (or plugin-internal import)
// here breaks the desktop build with nothing failing in THIS repo otherwise.
describe('browser safety', () => {
  it('wire.ts imports only valibot', () => {
    const source = readFileSync(new URL('./wire.ts', import.meta.url), 'utf8')
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map(entry => entry[1])
    expect([...new Set(specifiers)]).toEqual(['valibot'])
  })
})

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

describe('listing responses', () => {
  it('parses the source response with and without inputDirs', () => {
    const files = [{ path: 'src/inputs/TextInput.tsx', content: 'export const TextInput = 1' }]
    expect(v.is(sourceResponseSchema, { files })).toBe(true)
    expect(v.is(sourceResponseSchema, { files, inputDirs: ['src/inputs'] })).toBe(true)
  })

  it('parses the candidates envelope', () => {
    expect(
      v.is(candidatesResponseSchema, {
        candidates: [{ exportName: 'TextInput', exportPath: '@/inputs/TextInput' }]
      })
    ).toBe(true)
  })

  it('parses the artifacts listing, counts optional', () => {
    expect(
      v.is(artifactsResponseSchema, {
        files: [
          { path: 'src/models/pet.generated.ts', lines: 12, characters: 300 },
          { path: 'src/models/tag.generated.ts' }
        ]
      })
    ).toBe(true)
    expect(v.is(artifactsResponseSchema, { files: [{ path: 1 }] })).toBe(false)
  })
})
