import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  applyEdit,
  applyEditToClientJson,
  enrichmentEditSchema,
  type ClientJson,
  type EnrichmentEdit
} from './client-json.ts'
import { readLeaf, type EnrichmentTree, type SubjectRef } from './enrichment-leaf.ts'

const op: SubjectRef = { type: 'operation', path: '/widgets', method: 'post' }
const GEN = '@scope/gen-x'

describe('applyEdit dispatch', () => {
  it('writeLeaf writes the addressed leaf', () => {
    const next = applyEdit(
      {},
      {
        op: 'writeLeaf',
        generator: GEN,
        subject: op,
        variant: 'main',
        values: { title: 'Create' },
        describedKeys: ['title']
      }
    )
    expect(readLeaf(next, GEN, op, 'main')).toEqual({ title: 'Create' })
  })

  it('addVariant then renameVariant moves the named leaf', () => {
    let tree: EnrichmentTree = applyEdit(
      {},
      { op: 'addVariant', generator: GEN, subject: op, variant: 'customer' }
    )
    tree = applyEdit(tree, {
      op: 'writeLeaf',
      generator: GEN,
      subject: op,
      variant: 'customer',
      values: { title: 'C' },
      describedKeys: ['title']
    })
    tree = applyEdit(tree, {
      op: 'renameVariant',
      generator: GEN,
      subject: op,
      from: 'customer',
      to: 'enterprise'
    })
    expect(readLeaf(tree, GEN, op, 'enterprise')).toEqual({ title: 'C' })
  })

  it('writeStackScope writes the reserved _stack leaf', () => {
    const next = applyEdit(
      {},
      {
        op: 'writeStackScope',
        values: { apiTitle: 'Billing' },
        describedKeys: ['apiTitle']
      }
    )
    expect(next).toEqual({ _stack: { apiTitle: 'Billing' } })
  })
})

describe('applyEditToClientJson', () => {
  it('updates the enrichments subtree and preserves every other field', () => {
    const clientJson: ClientJson = {
      source: './openapi.json',
      settings: { basePath: 'src', enrichments: { other: { keep: true } } }
    }
    const edit: EnrichmentEdit = {
      op: 'writeLeaf',
      generator: GEN,
      subject: op,
      variant: 'main',
      values: { title: 'X' },
      describedKeys: ['title']
    }
    const next = applyEditToClientJson(clientJson, edit)
    expect(next.source).toBe('./openapi.json')
    expect(next.settings.basePath).toBe('src')
    // existing enrichments preserved, new leaf added
    expect(next.settings.enrichments).toMatchObject({
      other: { keep: true },
      [GEN]: { '/widgets': { post: { main: { title: 'X' } } } }
    })
  })

  it('tolerates a missing enrichments key', () => {
    const clientJson: ClientJson = { settings: { basePath: 'src' } }
    const next = applyEditToClientJson(clientJson, {
      op: 'writeStackScope',
      values: { apiTitle: 'X' },
      describedKeys: ['apiTitle']
    })
    expect(next.settings.enrichments).toEqual({ _stack: { apiTitle: 'X' } })
  })
})

describe('enrichmentEditSchema (boundary validation)', () => {
  it('parses a valid writeLeaf edit', () => {
    const parsed = v.parse(enrichmentEditSchema, {
      op: 'writeLeaf',
      generator: GEN,
      subject: { type: 'operation', path: '/x', method: 'get' },
      variant: 'main',
      values: { a: 1 },
      describedKeys: ['a']
    })
    expect(parsed.op).toBe('writeLeaf')
  })

  it('rejects an unknown op', () => {
    expect(() => v.parse(enrichmentEditSchema, { op: 'nope' })).toThrow()
  })

  it('rejects a malformed subject', () => {
    expect(() =>
      v.parse(enrichmentEditSchema, {
        op: 'addVariant',
        generator: GEN,
        subject: { type: 'banana' },
        variant: 'x'
      })
    ).toThrow()
  })
})
