import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'runtime-discipline'

Deno.test('runtime-discipline: flags node-isms', () => {
  const messages = messagesFrom(
    RULE,
    `const home = process.env.HOME
     const mod = require('node:path')`
  )
  assertEquals(messages.length, 2)
  assertStringIncludes(messages[0] ?? '', 'process.env — node-ism')
})

Deno.test('runtime-discipline: flags filesystem access', () => {
  const messages = messagesFrom(
    RULE,
    `import { readFileSync } from 'node:fs'
     const write = () => Deno.writeTextFileSync('out.ts', 'x')
     const read = () => Deno.readTextFileSync('in.ts')`
  )
  assertEquals(messages.length, 3)
  assertStringIncludes(messages.join('\n'), "import from 'node:fs' — fs")
  assertStringIncludes(messages.join('\n'), 'Deno.writeTextFileSync — fs')
})

Deno.test('runtime-discipline: silent on Deno.env — the sanctioned env read', () => {
  assertEquals(lint(RULE, `const token = Deno.env.get('TOKEN')`), [])
})

Deno.test('runtime-discipline: flags network and timers', () => {
  const source = `const a = () => fetch('https://example.com')
    const b = () => new WebSocket('wss://example.com')
    const c = () => setTimeout(() => undefined, 10)
    const d = () => setInterval(() => undefined, 10)`
  assertEquals(lint(RULE, source).length, 4)
})

Deno.test('runtime-discipline: flags every async construct', () => {
  const source = `async function one() {}
    const two = async () => undefined
    class Value extends TsSnippet {
      async render() { return 'x' }
    }
    const three = () => { const value = getValue(); return value }
    const four = () => promise.then(value => value)
    const five = new Promise(resolve => resolve(undefined))
    const six = async () => { await load() }`
  const messages = messagesFrom(RULE, source)
  // async function, async arrow, async method, .then(cb), new Promise,
  // the sixth async arrow, and its await
  assertEquals(messages.length, 7)
  assertStringIncludes(messages.join('\n'), 'await expression — async')
  assertStringIncludes(messages.join('\n'), 'new Promise(…) — async')
  assertStringIncludes(messages.join('\n'), '.then(callback) — async')
})

Deno.test('runtime-discipline: silent on await and fetch inside EMITTED text', () => {
  const source = `class QueryHook extends TsSnippet {
      override toString(): string {
        return \`export const useThing = () => {
  const query = useQuery({ queryFn: async () => {
    const response = await fetch('/thing')
    return response.json()
  } })
  return query
}\`
      }
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('runtime-discipline: silent on .then without a callback', () => {
  assertEquals(lint(RULE, `const chained = promise.then()`), [])
})

Deno.test('runtime-discipline: silent in test files and under scripts/', () => {
  const source = `async function seed() { await Deno.writeTextFile('a', 'b') }`
  assertEquals(lint(RULE, source, '/gen-thing/src/seed.test.ts'), [])
  assertEquals(lint(RULE, source, '/gen-thing/scripts/seed.ts'), [])
})
