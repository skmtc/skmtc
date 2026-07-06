import { describe, it, expect } from 'vitest'
import {
  MAIN_VARIANT,
  addVariant,
  generatorScopePath,
  leafPath,
  listVariants,
  readGeneratorScope,
  readLeaf,
  readStackScope,
  removeVariant,
  renameVariant,
  stackScopePath,
  validateVariantName,
  writeGeneratorScope,
  writeLeaf,
  writeStackScope,
  type EnrichmentTree,
  type SubjectRef
} from './enrichment-leaf.ts'

const op: SubjectRef = { type: 'operation', path: '/widgets', method: 'post' }
const model: SubjectRef = { type: 'model', refName: 'Widget' }
const GEN = '@scope/gen-x'

describe('addressing', () => {
  it('operation leaf is [gen, path, method, variant]', () => {
    expect(leafPath(GEN, op, 'main')).toEqual([GEN, '/widgets', 'post', 'main'])
  })
  it('model leaf is [gen, refName, variant]', () => {
    expect(leafPath(GEN, model, 'main')).toEqual([GEN, 'Widget', 'main'])
  })
  it('reserved scope addresses', () => {
    expect(generatorScopePath(GEN)).toEqual([GEN, '_generator'])
    expect(stackScopePath()).toEqual(['_stack'])
  })
})

describe('reads', () => {
  const tree: EnrichmentTree = {
    [GEN]: {
      '/widgets': { post: { main: { title: 'Create' }, customer: { title: 'Cust' } } },
      Widget: { main: { coerce: true } },
      _generator: { strict: true }
    },
    _stack: { apiTitle: 'Billing' }
  }

  it('readLeaf returns the leaf, or {} when absent', () => {
    expect(readLeaf(tree, GEN, op, 'main')).toEqual({ title: 'Create' })
    expect(readLeaf(tree, GEN, op, 'missing')).toEqual({})
    expect(readLeaf(tree, GEN, model, 'main')).toEqual({ coerce: true })
  })
  it('listVariants is main-first, named sorted', () => {
    expect(listVariants(tree, GEN, op)).toEqual(['main', 'customer'])
    expect(listVariants(tree, GEN, model)).toEqual(['main'])
    // absent subject → just main
    expect(listVariants(tree, GEN, { type: 'model', refName: 'Gadget' })).toEqual(['main'])
  })
  it('reads run-constant scopes', () => {
    expect(readGeneratorScope(tree, GEN)).toEqual({ strict: true })
    expect(readStackScope(tree)).toEqual({ apiTitle: 'Billing' })
    expect(readGeneratorScope({}, GEN)).toEqual({})
  })
})

describe('writeLeaf', () => {
  it('writes a leaf at the addressed position (operation)', () => {
    const next = writeLeaf({}, GEN, op, 'main', { title: 'Create' }, ['title'])
    expect(next).toEqual({ [GEN]: { '/widgets': { post: { main: { title: 'Create' } } } } })
  })

  it('preserves undescribed (drifted) keys, edits described ones', () => {
    const tree: EnrichmentTree = { [GEN]: { Widget: { main: { title: 'old', legacy: 1 } } } }
    // descriptor controls only `title`; `legacy` is drift → preserved.
    const next = writeLeaf(tree, GEN, model, 'main', { title: 'new' }, ['title'])
    expect(readLeaf(next, GEN, model, 'main')).toEqual({ title: 'new', legacy: 1 })
  })

  it('an empty/absent described value clears that key', () => {
    const tree: EnrichmentTree = { [GEN]: { Widget: { main: { title: 'x' } } } }
    const next = writeLeaf(tree, GEN, model, 'main', { title: '' }, ['title'])
    // last described key cleared, no drift → subject prunes entirely
    expect(next).toEqual({})
  })

  it('drops an emptied main when the subject has no named variants', () => {
    const tree: EnrichmentTree = { [GEN]: { Widget: { main: { title: 'x' } } } }
    const next = writeLeaf(tree, GEN, model, 'main', {}, ['title'])
    expect(next).toEqual({})
  })

  it('keeps an emptied main as an anchor when named variants exist', () => {
    const tree: EnrichmentTree = {
      [GEN]: { '/widgets': { post: { main: { title: 'x' }, customer: { title: 'c' } } } }
    }
    const next = writeLeaf(tree, GEN, op, 'main', {}, ['title'])
    expect(readLeaf(next, GEN, op, 'main')).toEqual({})
    expect(listVariants(next, GEN, op)).toEqual(['main', 'customer'])
  })

  it('keeps an emptied NAMED variant (its existence is the declaration)', () => {
    const tree: EnrichmentTree = {
      [GEN]: { '/widgets': { post: { main: { title: 'x' }, customer: { title: 'c' } } } }
    }
    const next = writeLeaf(tree, GEN, op, 'customer', {}, ['title'])
    expect(readLeaf(next, GEN, op, 'customer')).toEqual({})
  })

  it('does not mutate its input tree', () => {
    const tree: EnrichmentTree = { [GEN]: { Widget: { main: { title: 'x' } } } }
    const before = structuredClone(tree)
    const next = writeLeaf(tree, GEN, model, 'main', { title: 'y' }, ['title'])
    expect(next).not.toBe(tree)
    expect(tree).toEqual(before)
  })
})

describe('run-constant scope writes', () => {
  it('writes and clears the generator scope', () => {
    const set = writeGeneratorScope({}, GEN, { strict: true }, ['strict'])
    expect(set).toEqual({ [GEN]: { _generator: { strict: true } } })
    const cleared = writeGeneratorScope(set, GEN, { strict: undefined }, ['strict'])
    expect(cleared).toEqual({})
  })
  it('writes and clears the stack scope', () => {
    const set = writeStackScope({}, { apiTitle: 'X' }, ['apiTitle'])
    expect(set).toEqual({ _stack: { apiTitle: 'X' } })
    expect(writeStackScope(set, { apiTitle: '' }, ['apiTitle'])).toEqual({})
  })
})

describe('variant management', () => {
  it('addVariant materialises an empty named variant AND anchors main', () => {
    const next = addVariant({}, GEN, op, 'customer')
    expect(listVariants(next, GEN, op)).toEqual(['main', 'customer'])
    expect(readLeaf(next, GEN, op, 'customer')).toEqual({})
    expect(readLeaf(next, GEN, op, 'main')).toEqual({})
  })
  it('addVariant is a no-op for main and for an existing variant', () => {
    expect(addVariant({}, GEN, op, MAIN_VARIANT)).toEqual({})
    const once = addVariant({}, GEN, op, 'customer')
    expect(addVariant(once, GEN, op, 'customer')).toEqual(once)
  })
  it('removeVariant drops the named variant; prunes a lone empty main', () => {
    const seeded = addVariant({}, GEN, op, 'customer') // main:{}, customer:{}
    expect(removeVariant(seeded, GEN, op, 'customer')).toEqual({})
  })
  it('removeVariant keeps a non-empty main after dropping the last named', () => {
    let tree = writeLeaf({}, GEN, op, 'main', { title: 'keep' }, ['title'])
    tree = addVariant(tree, GEN, op, 'customer')
    const next = removeVariant(tree, GEN, op, 'customer')
    expect(readLeaf(next, GEN, op, 'main')).toEqual({ title: 'keep' })
    expect(listVariants(next, GEN, op)).toEqual(['main'])
  })
  it('renameVariant moves a named variant leaf, leaving main alone', () => {
    let tree = writeLeaf({}, GEN, op, 'customer', { title: 'c' }, ['title'])
    tree = renameVariant(tree, GEN, op, 'customer', 'enterprise')
    expect(readLeaf(tree, GEN, op, 'enterprise')).toEqual({ title: 'c' })
    expect(readLeaf(tree, GEN, op, 'customer')).toEqual({})
  })
  it('rename is a no-op when main is involved or source is absent', () => {
    const tree: EnrichmentTree = { [GEN]: { '/widgets': { post: { main: { title: 'x' } } } } }
    expect(renameVariant(tree, GEN, op, MAIN_VARIANT, 'x')).toEqual(tree)
    expect(renameVariant(tree, GEN, op, 'absent', 'x')).toEqual(tree)
  })
})

describe('round-trip', () => {
  it('read → write the same values is identity', () => {
    const tree: EnrichmentTree = {
      [GEN]: { '/widgets': { post: { main: { title: 'Create', size: 3 } } } }
    }
    const leaf = readLeaf(tree, GEN, op, 'main')
    const next = writeLeaf(tree, GEN, op, 'main', leaf, ['title', 'size'])
    expect(next).toEqual(tree)
  })
})

describe('validateVariantName', () => {
  it('rejects empty, main, bad format, and dupes; accepts kebab', () => {
    expect(validateVariantName('', [])).toMatch(/Enter/)
    expect(validateVariantName('main', [])).toMatch(/reserved/)
    expect(validateVariantName('Bad_Name', [])).toMatch(/kebab/)
    expect(validateVariantName('customer', ['customer'])).toMatch(/already/)
    expect(validateVariantName('line-items', [])).toBeNull()
  })
})
