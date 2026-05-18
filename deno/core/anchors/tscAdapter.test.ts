import { assert, assertEquals } from '@std/assert'
import { tscAdapter } from './tscAdapter.ts'

const parse = (source: string) => tscAdapter.parse('test.ts', source)

Deno.test('tscAdapter - id is tagged with the active tsc version', () => {
  assert(tscAdapter.id.startsWith('tsc@'))
})

Deno.test('tscAdapter - collectLandmarks finds every named top-level export', () => {
  const src = `
export const A = 1
export let B = 2
export var C = 3
export function D() {}
export class E {}
export type F = string
export interface G {}
export enum H { X, Y }
`
  const file = parse(src)
  const landmarks = tscAdapter.collectLandmarks(file)
  assertEquals(
    [...landmarks.keys()].sort(),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  )
})

Deno.test('tscAdapter - collectLandmarks skips non-exported declarations', () => {
  const src = `
const local = 1
export const exported = 2
`
  const file = parse(src)
  const landmarks = tscAdapter.collectLandmarks(file)
  assertEquals([...landmarks.keys()], ['exported'])
})

Deno.test('tscAdapter - collectLandmarks skips anonymous default exports', () => {
  const src = `export default 42`
  const file = parse(src)
  const landmarks = tscAdapter.collectLandmarks(file)
  assertEquals(landmarks.size, 0)
})

Deno.test('tscAdapter - collectLandmarks handles multi-declarator variable statements', () => {
  const src = `export const a = 1, b = 2, c = 3`
  const file = parse(src)
  const landmarks = tscAdapter.collectLandmarks(file)
  assertEquals([...landmarks.keys()].sort(), ['a', 'b', 'c'])
})

Deno.test('tscAdapter - smallestEnclosing returns the narrowest containing node', () => {
  const src = `export const x = foo(bar(42))`
  const file = parse(src)
  // Position of `42` in the source.
  const from = src.indexOf('42')
  const to = from + 2

  const node = tscAdapter.smallestEnclosing(file, from, to)
  // The smallest enclosing node should be the NumericLiteral itself
  // (or its containing argument list, depending on how forEachChild
  // visits). Assert by checking the resolved node's text-range slice.
  // deno-lint-ignore no-explicit-any
  const n = node as any
  assertEquals(src.slice(n.getStart(file), n.getEnd()), '42')
})

Deno.test('tscAdapter - smallestEnclosing falls back to root for span outside any tighter node', () => {
  const src = `\n\nexport const x = 1\n\n`
  const file = parse(src)
  // Range spanning the entire file — only the SourceFile encloses it.
  const node = tscAdapter.smallestEnclosing(file, 0, src.length)
  // deno-lint-ignore no-explicit-any
  const n = node as any
  // SourceFile's getEnd is the file length.
  assertEquals(n.getEnd(), src.length)
})

Deno.test('tscAdapter - ascendToLandmark returns landmark name + path', () => {
  const src = `export const greeting = 'hello world'`
  const file = parse(src)
  const landmarks = tscAdapter.collectLandmarks(file)

  // Find `'hello world'` precisely.
  const from = src.indexOf("'hello world'")
  const to = from + "'hello world'".length
  const node = tscAdapter.smallestEnclosing(file, from, to)

  const { landmark, path } = tscAdapter.ascendToLandmark(node, landmarks)
  assertEquals(landmark, 'greeting')
  // Non-empty path means the node is nested inside the landmark.
  assert(path.length > 0)
})

Deno.test('tscAdapter - ascendToLandmark returns empty landmark when none found', () => {
  // No exported declarations — nothing is a landmark.
  const src = `const x = 1`
  const file = parse(src)
  const landmarks = tscAdapter.collectLandmarks(file)
  const node = tscAdapter.smallestEnclosing(file, 0, src.length)
  const { landmark, path } = tscAdapter.ascendToLandmark(node, landmarks)
  assertEquals(landmark, '')
  assertEquals(path, [])
})

Deno.test('tscAdapter - ascendToLandmark on the landmark node itself yields empty path', () => {
  const src = `export const x = 1`
  const file = parse(src)
  const landmarks = tscAdapter.collectLandmarks(file)
  const landmarkNode = landmarks.get('x')!
  const { landmark, path } = tscAdapter.ascendToLandmark(landmarkNode, landmarks)
  assertEquals(landmark, 'x')
  assertEquals(path, [])
})

Deno.test('tscAdapter - path is forEachChild-indexed (excludes punctuation tokens)', () => {
  const src = `export const x = [1, 2, 3]`
  const file = parse(src)
  const landmarks = tscAdapter.collectLandmarks(file)

  // Find the literal `2` in the array.
  const from = src.indexOf('2')
  const to = from + 1
  const node = tscAdapter.smallestEnclosing(file, from, to)

  const { landmark, path } = tscAdapter.ascendToLandmark(node, landmarks)
  assertEquals(landmark, 'x')
  // Path should be stable indices; `2` is the second element so its
  // child index inside the array literal is 1. The full path depth
  // depends on forEachChild order from `export const x` through
  // VariableDeclarationList → VariableDeclaration → ArrayLiteral.
  // We just assert it ends with index 1 (the array position).
  assertEquals(path[path.length - 1], 1)
})

Deno.test('tscAdapter - .tsx files parse without choking on JSX', () => {
  const file = tscAdapter.parse('out.tsx', `export const X = () => <div>hi</div>`)
  const landmarks = tscAdapter.collectLandmarks(file)
  assertEquals([...landmarks.keys()], ['X'])
})
