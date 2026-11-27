import { assertEquals } from '@std/assert'
import { isSwitch, scoreSource, toLimitedScore, toOptions } from './complexity.ts'

const toScores = (text: string): Record<string, number> =>
  Object.fromEntries(scoreSource({ file: 'x.ts', text }).map(unit => [unit.name, unit.score]))

Deno.test('a function with no branch scores 1', () => {
  assertEquals(toScores('const toName = (name: string) => `${name}Type`'), { toName: 1 })
})

Deno.test('each branch adds 1: if, ?:, &&, ||, ??, a loop, catch', () => {
  const text = `
    function decide(a: boolean, b: string | undefined, items: string[]) {
      if (a && items.length > 0) { return b ?? 'none' }
      for (const item of items) { try { item.at(0) } catch { return a || b ? 'x' : 'y' } }
      return 'z'
    }`

  // 1 + if + && + ?? + for + catch + || + ?:
  assertEquals(toScores(text), { decide: 8 })
})

// The trap: counting a callback as a unit of its own would give the constructor
// a score of 1 and hide the branch that its reader has to follow.
Deno.test('an inline callback counts toward the unit around it', () => {
  const text = `
    class Entries {
      names: string[]
      constructor(names: (string | undefined)[]) {
        this.names = names.map(name => (name === undefined ? '' : name))
      }
      toString() { return this.names.toString() }
    }`

  assertEquals(toScores(text), { 'Entries.constructor': 2, 'Entries.toString': 1 })
})

Deno.test('a method, a config method and a function outside a class are each a unit', () => {
  const text = `
    export const Base = toBase({ toIdentifierName({ ref }) { return ref.refName } })
    export const toAlias = (name: string) => name
    class Value { toString() { return '' } }`

  const units = scoreSource({ file: 'x.ts', text })

  assertEquals(
    units.map(unit => [unit.name, unit.outsideClass]),
    [
      ['toIdentifierName', true],
      ['toAlias', true],
      ['Value.toString', false]
    ]
  )
})

Deno.test('a router is a switch, and a constructor with the same score is not', () => {
  const [router, constructor] = scoreSource({
    file: 'x.ts',
    text: `
      const toValue = (schema: { type: string; nullable?: boolean }) => {
        const nullable = schema.nullable ? true : false
        switch (schema.type) {
          case 'a': return 1
          case 'b': return 2
          case 'c': return 3
          default: return nullable
        }
      }
      class Big {
        constructor(a?: string, b?: string, c?: string, d?: string) {
          this.value = a ?? b ?? c ?? d ?? ''
        }
        value: string
      }`
  })

  assertEquals([router.score, router.cases, isSwitch(router)], [5, 3, true])
  assertEquals([constructor.score, constructor.cases, isSwitch(constructor)], [5, 0, false])
})

// The trap: an exemption for the whole function would let a router carry
// any number of `if`s. Only its cases are free.
Deno.test('the limit applies to the branches of a router that are not cases', () => {
  const [router] = scoreSource({
    file: 'x.ts',
    text: `
      const toValue = (schema: { type: string; a?: string; b?: string; c?: string }) => {
        const fallback = schema.a ?? schema.b ?? schema.c ?? ''
        switch (schema.type) {
          case 'a': return 1
          case 'b': return 2
          case 'c': return 3
          case 'd': return 4
          default: return fallback
        }
      }`
  })

  assertEquals([router.score, router.cases, isSwitch(router)], [8, 4, true])
  assertEquals(toLimitedScore(router), 4)
})

Deno.test('the logical assignments &&=, ||= and ??= each add 1', () => {
  const text = `
    function fill(a: { x?: number; y?: number; z?: number }) {
      a.x ??= 1
      a.y ||= 2
      a.z &&= 3
    }`

  assertEquals(toScores(text), { fill: 4 })
})

// The trap: a function with no name and no unit around it would be scored
// nowhere, and its branches would not be in the report at all.
Deno.test('a default export with no name is a unit', () => {
  const text = `export default (schema: { nullable?: boolean }) => (schema.nullable ? 'a' : 'b')`

  assertEquals(toScores(text), { '<default>': 2 })
})

Deno.test('a callback that no unit holds is a unit', () => {
  const text = `[1, 2].forEach(item => { if (item > 1) { console.log(item) } })`

  assertEquals(toScores(text), { '<anonymous>': 2 })
})

Deno.test('the value of a field or of a module variable is a unit when it branches', () => {
  const text = `
    const items: (string | undefined)[] = []
    const labels = items.map(item => (item === undefined ? '' : item))
    class Entries {
      names = items.map(item => item ?? '')
      count = items.length
      toString() { return this.names.join(', ') }
    }`

  assertEquals(toScores(text), { labels: 2, 'Entries.names': 2, 'Entries.toString': 1 })
})

Deno.test('the limit is read from --max 5 and from --max=5', () => {
  assertEquals(toOptions(['src']), { root: 'src', max: 10 })
  assertEquals(toOptions(['src', '--max', '5']), { root: 'src', max: 5 })
  assertEquals(toOptions(['--max=5', 'src']), { root: 'src', max: 5 })
})

// The trap: an argument that is dropped without a message leaves the limit at
// 10, and a run that was meant to be stricter passes.
Deno.test('an argument the script does not know gives no options', () => {
  assertEquals(toOptions(['src', '--limit=5']), undefined)
  assertEquals(toOptions(['src', '--max']), undefined)
  assertEquals(toOptions(['src', '--max=five']), undefined)
  assertEquals(toOptions(['src', '--max=0']), undefined)
  assertEquals(toOptions(['src', 'other']), undefined)
  assertEquals(toOptions([]), undefined)
})
