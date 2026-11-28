import { assertEquals, assertStringIncludes } from '@std/assert'
import {
  isSwitch,
  scoreSource
} from '../../../docs/skills/skmtc-generator/scripts/complexity.ts'
import { lint, messagesFrom } from '../test/lint.ts'
import { toComplexityRule } from './complexity.ts'

const RULE = 'complexity'

const FILENAME = '/root/.skmtc/lab/gen-thing/src/Value.ts'

/** `count` lines, each one a branch: `if (a1) { return 1 }`, … */
const toIfs = (count: number): string =>
  Array.from({ length: count }, (_value, index) => `if (a${index}) { return ${index} }`).join('\n')

/** `count` cases of a `switch`. */
const toCases = (count: number): string =>
  Array.from({ length: count }, (_value, index) => `case 'k${index}': return ${index}`).join('\n')

Deno.test('complexity: silent at the limit, and reports one over it', () => {
  // 1 + 9 ifs = 10.
  assertEquals(lint(RULE, `function decide() {\n${toIfs(9)}\n}`), [])

  // 1 + 10 ifs = 11.
  assertEquals(messagesFrom(RULE, `function decide() {\n${toIfs(10)}\n}`), [
    'decide has a complexity of 11; the limit is 10'
  ])
})

Deno.test('complexity: a constructor is named with its class, and the hint says how to split', () => {
  const diagnostics = lint(
    RULE,
    `class MockRoute extends TsSnippet {
       constructor(args: Args) {
         super(args)
         ${toIfs(11)}
       }
       override toString(): string { return '' }
     }`
  )

  assertEquals(
    diagnostics.map(diagnostic => diagnostic.message),
    ['MockRoute.constructor has a complexity of 12; the limit is 10']
  )
  assertStringIncludes(diagnostics[0].hint ?? '', 'Split by concept, not by line count')
})

// The trap: a router has one case for each schema type, so a plain count
// fails every generator at the place that is right to branch.
Deno.test('complexity: the cases of a router do not count', () => {
  const router = `export const toTsValue = ({ schema }: Args): TsValue => {
    switch (schema.type) {
      ${toCases(13)}
      default: throw new Error('unmapped')
    }
  }`

  assertEquals(lint(RULE, router), [])
})

// The trap: an exemption for the whole function would let a router carry
// any number of other branches.
Deno.test('complexity: the other branches of a router count', () => {
  const router = `export const toTsValue = ({ schema }: Args): TsValue => {
    ${toIfs(10)}
    switch (schema.type) {
      ${toCases(13)}
      default: throw new Error('unmapped')
    }
  }`

  assertEquals(messagesFrom(RULE, router), [
    'toTsValue has a complexity of 11 without its 13 switch cases (24 with them); the limit is 10'
  ])
})

Deno.test('complexity: a callback written inline counts toward the function around it', () => {
  const source = `class Entries {
    constructor(items: Item[]) {
      this.names = items.map(item => {
        ${toIfs(10)}
        return item.name
      })
    }
  }`

  assertEquals(messagesFrom(RULE, source), [
    'Entries.constructor has a complexity of 11; the limit is 10'
  ])
})

Deno.test('complexity: a named function inside another is a unit of its own', () => {
  const source = `function outer() {
    ${toIfs(6)}
    const inner = () => {
      ${toIfs(6)}
    }
    return inner
  }`

  // 7 and 7: neither is over, and together they would be 13.
  assertEquals(lint(RULE, source), [])
})

Deno.test('complexity: the value of a class field and a default export are units', () => {
  const field = `class Entries {
    names = items.map(item => {
      ${toIfs(10)}
      return item
    })
  }`

  const defaultExport = `export default (schema: Schema) => {
    ${toIfs(10)}
  }`

  assertEquals(messagesFrom(RULE, field), ['Entries.names has a complexity of 11; the limit is 10'])
  assertEquals(messagesFrom(RULE, defaultExport), [
    '<default> has a complexity of 11; the limit is 10'
  ])
})

// The trap: `deno lint --json` does not escape a line break in a message,
// so one name that spans lines makes the whole report unreadable.
Deno.test('complexity: a name that spans lines is quoted on one line', () => {
  const source = `export const {
    name,
    path
  } = [1].reduce((acc, n) => {
    ${toIfs(10)}
    return acc
  }, { name: '', path: '' })`

  assertEquals(messagesFrom(RULE, source), [
    '{ name, path } has a complexity of 11; the limit is 10'
  ])
})

// The trap: the report was at the function. For `const x =\n  (n) => …` that
// is one line below the name, and `deno lint` matches an ignore directive to
// the line where the report starts.
Deno.test('complexity: the report is at the name of the unit', () => {
  const source = `export const curried =
  (m: number) =>
  (n: number): number => {
    ${toIfs(10)}
    return m + n
  }`

  const [diagnostic] = lint(RULE, source)

  assertEquals(source.slice(diagnostic.range[0], diagnostic.range[1]), 'curried')
})

// The trap: `deno lint` matches a directive to the line where the report
// starts. A report at the key of a decorated member is one line below a
// decorator on its own line, where the directive goes.
Deno.test('complexity: a decorated member is reported at its first decorator', () => {
  const source = `class Table {
    @first()
    @second()
    toCode(n: number) {
      ${toIfs(10)}
    }
    @first()
    codes = [1].map(n => {
      ${toIfs(10)}
    })
  }`

  const diagnostics = lint(RULE, source)

  assertEquals(
    diagnostics.map(diagnostic => source.slice(diagnostic.range[0], diagnostic.range[1])),
    ['@first()', '@first()']
  )
})

// The trap: the rule read the whole file before a key, so a comment above
// a member that ends in `[` made a plain key read as computed.
Deno.test('complexity: a comment ending in a bracket above a member does not make its key computed', () => {
  const source = `class Indexed {
    // index into x[
    plain() {
      ${toIfs(10)}
    }
  }`

  assertEquals(messagesFrom(RULE, source), [
    'Indexed.plain has a complexity of 11; the limit is 10'
  ])
})

Deno.test('complexity: silent outside generator source', () => {
  const source = `function decide() {\n${toIfs(12)}\n}`

  assertEquals(lint(RULE, source, '/root/.skmtc/lab/gen-thing/src/Value.test.ts'), [])
  assertEquals(lint(RULE, source, '/root/.skmtc/lab/gen-thing/scripts/build.ts'), [])
})

// The skill's script and this rule are two programs with one count. A
// generator that passes one and fails the other has no way to know which
// is right, so the same sources go through both.
const PARITY_SOURCES: Record<string, string> = {
  branches: `
    function decide(a: boolean, b: string | undefined, items: string[], o: { x?: number }) {
      if (a && items.length > 0) { return b ?? 'none' }
      for (const item of items) { try { item.at(0) } catch { return a || b ? 'x' : 'y' } }
      for (const key in o) { while (a) { do { o.x ??= 1 } while (b) } }
      for (let i = 0; i < 2; i++) { o.x ||= 2; o.x &&= 3 }
      return 'z'
    }`,
  classes: `
    export const Base = toBase({
      toIdentifierName({ ref }) { return ref.refName ? ref.refName : 'x' },
      toExportPath: ({ ref }) => (ref.refPath ? 'a' : 'b')
    })
    export const toAlias = (name: string) => (name ? name : 'x')
    class Value {
      static create = (flag: boolean) => (flag ? 1 : 2)
      #secret() { return this.a ?? this.b }
      get label() { return this.a || 'none' }
      constructor(a?: string, b?: string) { this.a = a ?? b ?? '' }
      toString() { return this.a ? this.a : '' }
    }`,
  router: `
    const toValue = (schema: { type: string; nullable?: boolean }) => {
      const nullable = schema.nullable ? true : false
      switch (schema.type) {
        case 'a': return 1
        case 'b': return 2
        case 'c': return 3
        default: return nullable
      }
    }`,
  values: `
    const items: (string | undefined)[] = []
    const labels = items.map(item => (item === undefined ? '' : item))
    class Entries {
      names = items.map(item => item ?? '')
      count = items.length
    }
    export default (schema: { nullable?: boolean }) => (schema.nullable ? 'a' : 'b')`,
  keys: `
    const table = {
      'quoted-key': (x: boolean) => (x ? 1 : 2),
      [computed]: (x: boolean) => (x ? 1 : 2),
      get label() { return a || 'none' },
      [flag ? 'a' : 'b']() { return 1 }
    }
    const typed: (n: number) => number = n => (n ? 1 : 2)
    class Keyed {
      [computed]() { return a ? 1 : 2 }
      [flag ? 'a' : 'b']() { return 1 }
      @dec(a ? 1 : 2) decorated() { return a ? 1 : 2 }
      accessor names = items.map(item => item ?? '')
      accessor fn = (x: boolean) => (x ? 1 : 2)
    }`,
  nested: `
    function outer(a: boolean) {
      const inner = (b: boolean) => (b ? 1 : 2)
      return [1, 2].map(n => (a ? n : inner(a)))
    }
    globalThis.items.forEach(item => { if (item > 1) { console.log(item) } })`,
  // ESTree drops parentheses and the TypeScript tree keeps them, so a
  // function in parentheses was the unit `f` in the rule and part of
  // `A.method` in the script.
  parenthesized: `
    class A {
      method() {
        const f = (() => {
          if (a0) {}
          if (a1) {}
        })
        return f
      }
      field = ((x: boolean) => (x ? 1 : 2))
      value = (items.map(item => item ?? ''))
    }
    const table = { toCode: ((x: boolean) => (x ? 1 : 2)) }
    export default ((x: boolean) => (x ? 1 : 2))`,
  // A comment that ends in `[` above a member is not part of its key.
  comments: `
    class Indexed {
      // index into x[
      plain() { return a ? 1 : 2 }
      /* [ */ other() { return a ? 1 : 2 }
    }`,
  // The rule quoted a name with `toInlineText`, which cuts it at 60
  // characters, and the script gave it in full.
  longNames: `
    const table = {
      'a-key-that-is-much-longer-than-sixty-characters-so-a-truncation-shows': (x: boolean) =>
        (x ? 1 : 2)
    }
    export const {
      name,
      path
    } = [1].reduce((acc, n) => (n ? acc : acc), { name: '', path: '' })`
}

const UNIT_MESSAGE = /^(.+) has a complexity of (\d+)(?: without its (\d+) switch cases \((\d+) with them\))?;/

/** `name score cases` for each unit the rule reports with a limit of 0. */
const toRuleUnits = (source: string): string[] =>
  Deno.lint
    .runPlugin(
      { name: 'parity', rules: { complexity: toComplexityRule({ limit: 0 }) } },
      FILENAME,
      source
    )
    .map(diagnostic => {
      const [, name, limited, cases, total] = diagnostic.message.match(UNIT_MESSAGE) ?? []

      return `${name} ${total ?? limited} ${cases ?? 0}`
    })
    .sort()

/** The same for the script. The rule has no unit for a function with no branch. */
const toScriptUnits = (source: string): string[] =>
  scoreSource({ file: 'Value.ts', text: source })
    .filter(unit => unit.score > 1)
    .map(unit => `${unit.name} ${unit.score} ${isSwitch(unit) ? unit.cases : 0}`)
    .sort()

for (const [name, source] of Object.entries(PARITY_SOURCES)) {
  Deno.test(`complexity: the rule and the skill's script give the same count (${name})`, () => {
    const scriptUnits = toScriptUnits(source)

    // Guard the guard: a source with no branch would pass with two empty lists.
    assertEquals(scriptUnits.length > 0, true)
    assertEquals(toRuleUnits(source), scriptUnits)
  })
}
