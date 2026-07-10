import { assertEquals } from '@std/assert'
import { classifyThreeWay, mergeThreeWay, toChangedBaseRanges } from '@/lib/three-way.ts'

const base = ['const a = 1', 'const b = 2', 'const c = 3', 'const d = 4', 'const e = 5'].join('\n')

Deno.test('toChangedBaseRanges - identical texts produce no ranges', () => {
  assertEquals(toChangedBaseRanges(base, base), [])
})

Deno.test('toChangedBaseRanges - a single modified line', () => {
  const changed = base.replace('const c = 3', 'const c = 30')
  assertEquals(toChangedBaseRanges(base, changed), [{ start: 2, end: 3 }])
})

Deno.test('toChangedBaseRanges - an insertion is an empty range at its anchor', () => {
  const changed = base.replace('const c = 3', 'const c = 3\nconst c2 = 3.5')
  assertEquals(toChangedBaseRanges(base, changed), [{ start: 3, end: 3 }])
})

Deno.test('toChangedBaseRanges - a deletion covers the removed lines', () => {
  const changed = ['const a = 1', 'const b = 2', 'const d = 4', 'const e = 5'].join('\n')
  assertEquals(toChangedBaseRanges(base, changed), [{ start: 2, end: 3 }])
})

Deno.test('classifyThreeWay - edits in different regions do not collide', () => {
  // User edits the top, the generator changes the bottom.
  const ours = base.replace('const a = 1', 'const a = 100 // mine')
  const theirs = base.replace('const e = 5', 'const e = 50')

  assertEquals(classifyThreeWay({ base, ours, theirs }), 'non-overlapping')
})

Deno.test('classifyThreeWay - both sides changing the same line collide', () => {
  const ours = base.replace('const c = 3', 'const c = 3.14 // mine')
  const theirs = base.replace('const c = 3', 'const c = 300')

  assertEquals(classifyThreeWay({ base, ours, theirs }), 'collision')
})

Deno.test('classifyThreeWay - adjacent boundary changes are conservatively collisions', () => {
  // The user inserts after line 2; the generator modifies line 3 — a
  // merge would have to order them, so this counts as a collision.
  const ours = base.replace('const c = 3', 'const c = 3\nconst mine = true')
  const theirs = base.replace('const d = 4', 'const d = 40')

  assertEquals(classifyThreeWay({ base, ours, theirs }), 'collision')
})

Deno.test('classifyThreeWay - unchanged sides never collide', () => {
  const theirs = base.replace('const b = 2', 'const b = 20')

  assertEquals(classifyThreeWay({ base, ours: base, theirs }), 'non-overlapping')
  assertEquals(classifyThreeWay({ base, ours: theirs, theirs: base }), 'non-overlapping')
})

Deno.test('mergeThreeWay - splices both sides into the base', () => {
  const ours = base.replace('const a = 1', 'const a = 100 // mine')
  const theirs = base.replace('const e = 5', 'const e = 50')

  const result = mergeThreeWay({ base, ours, theirs })

  assertEquals(result.ok, true)
  if (!result.ok) return
  assertEquals(
    result.merged,
    ['const a = 100 // mine', 'const b = 2', 'const c = 3', 'const d = 4', 'const e = 50'].join(
      '\n'
    )
  )
})

Deno.test('mergeThreeWay - handles insertions and deletions on both sides', () => {
  // Ours inserts after line a; theirs deletes line e.
  const ours = base.replace('const a = 1', 'const a = 1\nconst mine = true')
  const theirs = ['const a = 1', 'const b = 2', 'const c = 3', 'const d = 4'].join('\n')

  const result = mergeThreeWay({ base, ours, theirs })

  assertEquals(result.ok, true)
  if (!result.ok) return
  assertEquals(
    result.merged,
    ['const a = 1', 'const mine = true', 'const b = 2', 'const c = 3', 'const d = 4'].join('\n')
  )
})

Deno.test('mergeThreeWay - refuses collisions with the touching base ranges', () => {
  const ours = base.replace('const c = 3', 'const c = 3.14 // mine')
  const theirs = base.replace('const c = 3', 'const c = 300')

  const result = mergeThreeWay({ base, ours, theirs })

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.collisions, [{ start: 2, end: 3 }])
})

Deno.test('mergeThreeWay - one unchanged side returns the other verbatim', () => {
  const theirs = base.replace('const b = 2', 'const b = 20')

  const result = mergeThreeWay({ base, ours: base, theirs })

  assertEquals(result.ok, true)
  if (!result.ok) return
  assertEquals(result.merged, theirs)
})
