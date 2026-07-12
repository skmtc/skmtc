import { describe, expect, it } from 'vitest'
import { parseForReanchor } from './reanchor.ts'
import fixture from './__fixtures__/traversal-conformance.json'

// Traversal-conformance contract with `@skmtc/core`'s oxcAdapter — see
// the core-side test (`deno/core/anchors/traversalConformance.test.ts`)
// for the full story. The fixture's landmark + path values were recorded
// by the core adapter; this mirror must resolve them onto the formatted
// text identically or the two traversals have drifted apart.

describe('traversal conformance with the core adapter', () => {
  it('resolves every fixture anchor to the same formatted slice', async () => {
    const parsed = await parseForReanchor('fixture.tsx', fixture.formatted)
    expect(parsed).toBeDefined()
    for (const anchor of fixture.anchors) {
      const outcome = parsed!.reanchor(anchor.landmark, anchor.path)
      expect(outcome.type, `${anchor.landmark} [${anchor.path}]`).toBe('resolved')
      if (outcome.type === 'resolved') {
        expect(fixture.formatted.slice(outcome.span[0], outcome.span[1])).toBe(
          anchor.formattedSlice
        )
      }
    }
  })
})
