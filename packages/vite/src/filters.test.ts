import { describe, expect, it } from 'vitest'
import { fromFilterEntries, toFilterEntries, type GeneratorFilter } from './filters.ts'

const flat: GeneratorFilter[] = [
  { generator: '@x/all-gen', scope: 'all', variants: [] },
  { generator: '@x/form', scope: 'operation', path: '/foo/', method: 'post', variants: [] },
  { generator: '@x/form', scope: 'operation', path: '/foo/', method: 'get', variants: ['compact'] },
  { generator: '@x/form', scope: 'operation', path: '/bar/', method: 'get', variants: [] },
  { generator: '@x/zod', scope: 'model', refName: 'Foo', variants: [] },
  { generator: '@x/zod', scope: 'model', refName: 'Bar', variants: ['slim'] }
]

const nested = [
  '@x/all-gen',
  { '@x/form': { '/foo/': { post: [], get: ['compact'] }, '/bar/': { get: [] } } },
  { '@x/zod': { Foo: [], Bar: ['slim'] } }
]

describe('toFilterEntries', () => {
  it('folds flat rows into the nested include/skip form', () => {
    expect(toFilterEntries(flat)).toEqual(nested)
  })

  it('returns [] for no rules', () => {
    expect(toFilterEntries([])).toEqual([])
  })
})

describe('fromFilterEntries', () => {
  it('unfolds the nested form back to flat rows (round-trip)', () => {
    expect(fromFilterEntries(nested)).toEqual(flat)
  })

  it('tolerates malformed nodes', () => {
    expect(
      fromFilterEntries([42, { '@x/gen': 'oops' }, { '@x/gen': { '/p/': { notamethod: [] } } }])
    ).toEqual([])
  })

  it('returns [] for a non-array', () => {
    expect(fromFilterEntries(undefined)).toEqual([])
    expect(fromFilterEntries({})).toEqual([])
  })
})
