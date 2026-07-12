import { assertEquals, assertExists } from '@std/assert'
import { oxcAdapter } from './oxcAdapter.ts'

/**
 * Traversal-conformance contract with `@skmtc/vite`'s re-anchor mirror.
 *
 * The reader in `packages/vite/src/reanchor.ts` re-implements this
 * adapter's traversal semantics (key-ordered child walk, whitespace-
 * JSXText filtering, ParenthesizedExpression transparency, all-top-level
 * landmarks) without importing core. The shared fixture pins the
 * behavior: this test asserts the ADAPTER still records exactly the
 * fixture's landmark + path and descends to the fixture's formatted
 * slice; the vite test (`reanchor-conformance.test.ts`) asserts its
 * mirror resolves the same fixture identically. If either side drifts
 * (or an oxc bump reorders AST keys), its test fails and the two must
 * be re-lockstepped together.
 */

type FixtureAnchor = {
  target: string
  landmark: string
  path: number[]
  formattedSlice: string
}

type Fixture = {
  raw: string
  formatted: string
  anchors: FixtureAnchor[]
}

const fixtureUrl = new URL(
  '../../../packages/vite/src/__fixtures__/traversal-conformance.json',
  import.meta.url
)
const fixture: Fixture = JSON.parse(Deno.readTextFileSync(fixtureUrl))

Deno.test('traversal conformance - adapter records the fixture paths and descends its slices', () => {
  const rawParsed = oxcAdapter.parse('fixture.tsx', fixture.raw)
  const rawLandmarks = oxcAdapter.collectLandmarks(rawParsed)
  const formattedParsed = oxcAdapter.parse('fixture.tsx', fixture.formatted)
  const formattedLandmarks = oxcAdapter.collectLandmarks(formattedParsed)

  for (const anchor of fixture.anchors) {
    const from = fixture.raw.indexOf(anchor.target)
    assertEquals(from >= 0, true, `target not found: ${anchor.target}`)
    const node = oxcAdapter.smallestEnclosing(rawParsed, from, from + anchor.target.length)
    const location = oxcAdapter.ascendToLandmark(node, rawLandmarks)
    assertEquals(location.landmark, anchor.landmark)
    assertEquals(location.path, anchor.path)

    const formattedLandmark = formattedLandmarks.get(anchor.landmark)
    assertExists(formattedLandmark)
    const reanchored = oxcAdapter.descendPath(formattedLandmark, anchor.path)
    assertExists(reanchored)
    const span = oxcAdapter.spanOf(reanchored)
    assertEquals(fixture.formatted.slice(span.start, span.end), anchor.formattedSlice)
  }
})
