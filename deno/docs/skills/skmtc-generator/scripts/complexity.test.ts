import { assertEquals } from '@std/assert'
import { isSwitch, scoreSource } from './complexity.ts'

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
