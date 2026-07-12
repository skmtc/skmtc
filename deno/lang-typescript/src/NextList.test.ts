import { assertEquals } from '@std/assert'
import { NextEntryList, NextKeyList, NextList } from './NextList.ts'

// ============================================================================
// Builders — mirror the patterns used at generator call sites
// ============================================================================

Deno.test('NextList - toObject renders an object literal', () => {
  const list = NextList.toObject(['readonly id: string', 'name: string'])
  assertEquals(list.toString(), '{readonly id: string, name: string}')
})

Deno.test('NextList - toArray renders an array literal', () => {
  const list = NextList.toArray([`'users'`, `'admins'`])
  assertEquals(list.toString(), `['users', 'admins']`)
})

Deno.test('NextList - toParams renders a parameter list', () => {
  const list = NextList.toParams(['id: string', 'options?: RequestOptions'])
  assertEquals(list.toString(), '(id: string, options?: RequestOptions)')
})

Deno.test('NextList - toLines renders newline-separated content', () => {
  const list = NextList.toLines([
    'import { useState } from "react"',
    'import { useEffect } from "react"'
  ])
  assertEquals(
    list.toString(),
    'import { useState } from "react"\nimport { useEffect } from "react"'
  )
})

Deno.test('NextList - toKeyValue renders a single colon-separated pair', () => {
  const list = NextList.toKeyValue('limit', '10')
  assertEquals(list.toString(), 'limit: 10')
})

Deno.test('NextList - toRecord renders an object with key-value pairs', () => {
  const list = NextList.toRecord({
    method: `'GET'`,
    headers: `{'Content-Type': 'application/json'}`
  })
  assertEquals(list.toString(), `{method: 'GET', headers: {'Content-Type': 'application/json'}}`)
})

Deno.test('NextList - toFilteredRecord drops undefined values', () => {
  const list = NextList.toFilteredRecord({
    header: `'Name'`,
    cell: undefined,
    footer: `'Total'`
  })
  assertEquals(list.toString(), `{header: 'Name', footer: 'Total'}`)
})

Deno.test('NextList - toFilteredRecord drops empty array values', () => {
  const list = NextList.toFilteredRecord({
    tags: ['admin', 'user'],
    permissions: []
  })
  assertEquals(list.toString(), `{tags: [admin, user]}`)
})

Deno.test('NextList - undefined items are filtered from any builder', () => {
  const list = NextList.toObject(['title', undefined, 'author'])
  assertEquals(list.toString(), '{title, author}')
})

// ============================================================================
// Empty handling
// ============================================================================

Deno.test('NextList - toEmpty renders as empty string', () => {
  assertEquals(NextList.toEmpty().toString(), '')
})

Deno.test('NextList - skipEmpty suppresses bookends when empty', () => {
  assertEquals(NextList.toObject([], { skipEmpty: true }).toString(), '')
  assertEquals(NextList.toObject(['x'], { skipEmpty: true }).toString(), '{x}')
})

Deno.test('NextList - hasValue distinguishes presence from emptiness', () => {
  assertEquals(NextList.hasValue('x'), true)
  assertEquals(NextList.hasValue(''), true) // empty string is still a value
  assertEquals(NextList.hasValue(undefined), false)
  assertEquals(NextList.hasValue([]), false)
  assertEquals(NextList.hasValue(['x']), true)
  assertEquals(NextList.hasValue(NextList.toEmpty()), false)
  assertEquals(NextList.hasValue(NextList.toSingle('x')), true)
})

// ============================================================================
// Conditional rendering — replaces the conditional-typed `List.toConditional`
// ============================================================================

Deno.test('NextList - toConditional renders value when condition is true', () => {
  const list = NextList.toConditional('?: string', true)
  assertEquals(list.toString(), '?: string')
})

Deno.test('NextList - toConditional renders empty when condition is false', () => {
  const list = NextList.toConditional('?: string', false)
  assertEquals(list.toString(), '')
})

Deno.test('NextList - toConditional composes inside a template literal', () => {
  const required = false
  const signature = `name${NextList.toConditional('?', !required)}: string`
  assertEquals(signature, 'name?: string')
})

// ============================================================================
// New: asymmetric prefix / suffix and per-item fixes
// ============================================================================

Deno.test('NextList - itemSuffix adds a trailing token per item', () => {
  // Trailing-comma style: each cell gets its own comma, even the last one.
  const list = new NextList(['a', 'b', 'c'], { separator: '\n', itemSuffix: ',' })
  assertEquals(list.toString(), 'a,\nb,\nc,')
})

Deno.test('NextList - itemPrefix indents each item', () => {
  // The common "indent every line by 2 spaces" pattern.
  const body = new NextList(['const x = 1', 'return x'], {
    separator: '\n',
    itemPrefix: '  '
  })
  const fn = `function f() {\n${body}\n}`
  assertEquals(fn, 'function f() {\n  const x = 1\n  return x\n}')
})

Deno.test('NextList - prefix and suffix wrap the body once', () => {
  // Useful for multi-line bracket layouts where bookends-only can't reach.
  const list = new NextList(['id', 'name', 'email'], {
    separator: ', ',
    prefix: ' ',
    suffix: ' ',
    bookends: '{}'
  })
  assertEquals(list.toString(), '{ id, name, email }')
})

Deno.test('NextList - asymmetric prefix supports leading-comma spread style', () => {
  // ", id, name" — a leading separator for spreading into an arg list.
  const extras = new NextList(['id', 'name'], { prefix: ', ' })
  assertEquals(`callApi(base${extras})`, 'callApi(base, id, name)')
})

Deno.test('NextList - all fixes combine in one render', () => {
  const list = new NextList(['1', '2', '3'], {
    bookends: '[]',
    separator: ',\n',
    prefix: '\n',
    suffix: '\n',
    itemPrefix: '  '
  })
  assertEquals(list.toString(), '[\n  1,\n  2,\n  3\n]')
})

// ============================================================================
// New: encapsulated mutation via add() / addAll()
// ============================================================================

Deno.test('NextList - add appends a value in the constructor', () => {
  const cells = NextList.toLines(['<TableCell>{name}</TableCell>'])
  cells.add('<TableCell><DeleteButton /></TableCell>')
  assertEquals(
    cells.toString(),
    '<TableCell>{name}</TableCell>\n<TableCell><DeleteButton /></TableCell>'
  )
})

Deno.test('NextList - add skips undefined silently', () => {
  const list = NextList.toLines<string>(['a'])
  list.add(undefined)
  list.add('b')
  assertEquals(list.toString(), 'a\nb')
})

Deno.test('NextList - addAll appends multiple values, dropping undefined', () => {
  const list = NextList.toArray<string>([])
  list.addAll(['a', undefined, 'b'])
  assertEquals(list.toString(), '[a, b]')
})

Deno.test('NextList - add is chainable', () => {
  const list = NextList.toLines<string>([]).add('first').add('second').add('third')
  assertEquals(list.toString(), 'first\nsecond\nthird')
})

Deno.test('NextList - items() returns a snapshot, not the live array', () => {
  const list = NextList.toArray<string>(['a', 'b'])
  const snapshot = list.items()
  list.add('c')
  // Snapshot doesn't see the later .add() — encapsulation preserved.
  assertEquals(snapshot, ['a', 'b'])
  assertEquals(list.toString(), '[a, b, c]')
})

Deno.test('NextList - size and isEmpty expose state without exposing the array', () => {
  const list = NextList.toLines<string>([])
  assertEquals(list.isEmpty, true)
  assertEquals(list.size, 0)
  list.add('row')
  assertEquals(list.isEmpty, false)
  assertEquals(list.size, 1)
})

// ============================================================================
// NextKeyList — bridges Record<string, _> shapes from OAS / schemas
// ============================================================================

Deno.test('NextKeyList - fromKeys handles undefined records', () => {
  assertEquals(NextList.fromKeys(undefined).toLinesPlain().toString(), '')
})

Deno.test('NextKeyList - toObjectPlain projects keys as a shorthand object', () => {
  // The common "destructure these keys" pattern.
  const props = NextList.fromKeys({ id: 1, name: 1, email: 1 }).toObjectPlain()
  assertEquals(props.toString(), '{id, name, email}')
})

Deno.test('NextKeyList - toObject maps keys via mapFn', () => {
  // Build an object where each key maps to a Zod field.
  const fields = NextList.fromKeys({ id: 1, name: 1 }).toObject(key =>
    NextList.toKeyValue(key, 'z.string()')
  )
  assertEquals(fields.toString(), '{id: z.string(), name: z.string()}')
})

Deno.test('NextKeyList - toLines maps keys via mapFn', () => {
  // Generate a series of import statements.
  const imports = NextList.fromKeys({ Button: 1, Input: 1 }).toLines(
    key => `import { ${key} } from '@/components/${key.toLowerCase()}'`
  )
  assertEquals(
    imports.toString(),
    `import { Button } from '@/components/button'\nimport { Input } from '@/components/input'`
  )
})

Deno.test('NextKeyList - is itself Stringable, defaulting to line-separated keys', () => {
  // No terminal method needed in the template — ${keys} works directly.
  const keys = new NextKeyList(['a', 'b', 'c'])
  assertEquals(`${keys}`, 'a\nb\nc')
})

// ============================================================================
// NextEntryList — the bridge for `Record<string, OasSchema>` shapes
// ============================================================================

Deno.test('NextEntryList - toLines maps entries into a multi-line snippet', () => {
  // Canonical pattern from gen-shadcn-form / gen-daisyui-form's FormFields.
  type Schema = { type: string }
  const properties: Record<string, Schema> = {
    name: { type: 'string' },
    age: { type: 'number' }
  }

  // Stand-in for `${name}: <Input lens={lens.focus('${name}').defined()} />`.
  const lines = NextList.fromEntries(properties).toLines(
    ([name, schema]) => `${name}: <Input type="${schema.type}" />`
  )

  assertEquals(lines.toString(), 'name: <Input type="string" />\nage: <Input type="number" />')
})

Deno.test('NextEntryList - toObject builds an object from entries', () => {
  const defaults = NextList.fromEntries({ retries: '3', timeout: '5000' }).toObject(
    ([key, value]) => NextList.toKeyValue(key, value)
  )
  assertEquals(defaults.toString(), '{retries: 3, timeout: 5000}')
})

Deno.test('NextEntryList - mapFn returning undefined drops that entry', () => {
  // Filter+map in a single pass — common for "only emit fields whose schema is supported".
  const supported = ['string', 'number']
  const properties = { id: 'string', avatar: 'binary', age: 'number' }

  const fields = NextList.fromEntries(properties).toLines(([name, type]) =>
    supported.includes(type) ? `${name}: ${type}` : undefined
  )

  assertEquals(fields.toString(), 'id: string\nage: number')
})

Deno.test('NextEntryList - is itself Stringable, defaulting to "key: value" lines', () => {
  const entries = new NextEntryList<string>([
    ['name', `'Alice'`],
    ['age', '30']
  ])
  assertEquals(`${entries}`, `name: 'Alice'\nage: 30`)
})

// ============================================================================
// Composition — the actual end-to-end shape generators produce
// ============================================================================

Deno.test('compose - building a function signature from a schema-like record', () => {
  // The pattern used in FunctionParameter.ts to destructure a typed parameter.
  const params = NextList.fromKeys({ id: 1, name: 1, email: 1 }).toObjectPlain()
  const signature = `function createUser${NextList.toParams([`${params}: CreateUserArgs`])}`

  assertEquals(signature, 'function createUser({id, name, email}: CreateUserArgs)')
})

Deno.test('compose - building a TanStack mutation options object', () => {
  // Stand-in for what MutationEndpoint / QueryEndpoint produce.
  const opts = NextList.toRecord({
    mutationKey: NextList.toArray([`'createUser'`]),
    mutationFn: 'createUserFn',
    onSuccess: '() => invalidateUsers()'
  })

  assertEquals(
    opts.toString(),
    `{mutationKey: ['createUser'], mutationFn: createUserFn, onSuccess: () => invalidateUsers()}`
  )
})

Deno.test('compose - filtered record drops generators-with-no-output cleanly', () => {
  // Mirrors gen-shadcn-table/TableColumn: only emit fields that have a value.
  const properties = NextList.toFilteredRecord({
    header: `'Name'`,
    cell: undefined, // no custom cell — render the default
    footer: undefined,
    enableSorting: 'true'
  })

  assertEquals(properties.toString(), `{header: 'Name', enableSorting: true}`)
})

Deno.test('compose - multiline object body using prefix/suffix/itemPrefix', () => {
  // Demonstrates the new asymmetric-wrap capability.
  const lines = new NextList(
    [NextList.toKeyValue('id', 'string'), NextList.toKeyValue('name', 'string')],
    {
      bookends: '{}',
      separator: ',\n',
      prefix: '\n',
      suffix: '\n',
      itemPrefix: '  '
    }
  )

  assertEquals(lines.toString(), '{\n  id: string,\n  name: string\n}')
})

// ============================================================================
// Purity — toString() must be deterministic across calls
// ============================================================================

Deno.test('NextList - toString is pure: repeated calls return the same value', () => {
  const list = NextList.toObject(['a', 'b']).add('c')
  const first = list.toString()
  const second = list.toString()
  const third = list.toString()
  assertEquals(first, '{a, b, c}')
  assertEquals(first, second)
  assertEquals(second, third)
})
