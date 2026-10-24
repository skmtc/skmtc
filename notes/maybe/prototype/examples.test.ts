import { assertEquals } from '@std/assert'
import { Group, Loop, Maybe, Nothing, Wrap } from '@/mod.ts'
import type { Stringable } from '@/mod.ts'

// Every code example in notes/maybe/README.md is one of these tests.

// --- Example 1: ShadcnTable heading -----------------------------------------
// Today: `${title || description ? '<div …>' : ''}`, `${title ? '<h2>…' : ''}`
// and so on — complexity 9 in ShadcnTable.toString(). With the classes the
// decisions sit in the constructor and toString() is a single interpolation.

type TableHeadingArgs = { title: string | undefined; description: string | undefined }

class TableHeading implements Stringable {
  heading: Maybe<Loop, Wrap>

  constructor({ title, description }: TableHeadingArgs) {
    const children = new Loop(
      [
        Maybe.nonEmptyText(
          title,
          t => new Wrap(['<h2 className="text-2xl font-semibold">', t, '</h2>'])
        ),
        Maybe.nonEmptyText(
          description,
          d => new Wrap(['<p className="text-muted-foreground">', d, '</p>'])
        )
      ],
      { separator: '\n' }
    )

    this.heading = new Maybe(
      children,
      loop => new Wrap(['<div className="flex flex-col gap-2">\n', loop, '\n</div>'])
    )
  }

  toString(): string {
    return `${this.heading}`
  }
}

Deno.test('heading: both parts present', () => {
  assertEquals(
    `${new TableHeading({ title: 'Pets', description: 'All pets' })}`,
    '<div className="flex flex-col gap-2">\n' +
      '<h2 className="text-2xl font-semibold">Pets</h2>\n' +
      '<p className="text-muted-foreground">All pets</p>\n' +
      '</div>'
  )
})

Deno.test('heading: one part present keeps the div', () => {
  assertEquals(
    `${new TableHeading({ title: undefined, description: 'All pets' })}`,
    '<div className="flex flex-col gap-2">\n<p className="text-muted-foreground">All pets</p>\n</div>'
  )
})

Deno.test('heading: both parts absent removes the div too', () => {
  assertEquals(`${new TableHeading({ title: undefined, description: '' })}`, '')
})

// --- Example 2: an object that always renders its braces --------------------
// No Maybe, so an empty Loop still renders `{}` (e.g. `z.object({})`).

Deno.test('wrap: braces survive an empty loop', () => {
  assertEquals(`${new Wrap(['z.object({', new Loop([]), '})'])}`, 'z.object({})')
  assertEquals(
    `${new Wrap(['z.object({', new Loop(['id: z.string()', 'name: z.string()']), '})'])}`,
    'z.object({id: z.string(), name: z.string()})'
  )
})

// --- Example 3: ZodInteger constraints --------------------------------------
// Today: nested `if (schema.minimum !== undefined) { if (exclusiveMinimum) … }`
// pushing into a List with skipEmpty. With the classes each keyword is one
// Maybe; `minimum: 0` is present because only undefined/null/''/false are absent.

type IntegerSchema = {
  minimum?: number
  exclusiveMinimum?: boolean
  maximum?: number
  exclusiveMaximum?: boolean
  multipleOf?: number
}

type ConstraintArgs = { name: string; value: number }

class ZodConstraint implements Stringable {
  name: string
  value: number

  constructor({ name, value }: ConstraintArgs) {
    this.name = name
    this.value = value
  }

  toString(): string {
    return `.${this.name}(${this.value})`
  }
}

type ZodIntegerArgs = { schema: IntegerSchema }

class ZodInteger implements Stringable {
  constraints: Loop

  constructor({ schema }: ZodIntegerArgs) {
    this.constraints = new Loop(
      [
        new Maybe(
          schema.minimum,
          value => new ZodConstraint({ name: schema.exclusiveMinimum ? 'gt' : 'gte', value })
        ),
        new Maybe(
          schema.maximum,
          value => new ZodConstraint({ name: schema.exclusiveMaximum ? 'lt' : 'lte', value })
        ),
        new Maybe(schema.multipleOf, value => new ZodConstraint({ name: 'multipleOf', value }))
      ],
      { separator: '' }
    )
  }

  toString(): string {
    return `z.number().int()${this.constraints}`
  }
}

Deno.test('constraints: absent keywords render nothing', () => {
  assertEquals(`${new ZodInteger({ schema: {} })}`, 'z.number().int()')
})

Deno.test('constraints: zero is a value, not an absence', () => {
  assertEquals(
    `${new ZodInteger({ schema: { minimum: 0, maximum: 10, exclusiveMaximum: true } })}`,
    'z.number().int().gte(0).lt(10)'
  )
})

// --- Example 4: build runs only for a present value -------------------------
// Constructors have side effects (register imports). An absent value must not
// construct the Snippet that would render it, or the import leaks into output.

type RegisteredArgs = { name: string; imports: string[] }

class Registered implements Stringable {
  name: string

  constructor({ name, imports }: RegisteredArgs) {
    this.name = name
    imports.push(name)
  }

  toString(): string {
    return this.name
  }
}

const toRef = (refName: string | undefined, imports: string[]): Maybe<string, Registered> =>
  new Maybe(refName, name => new Registered({ name, imports }))

Deno.test('build: not called when the subject is absent', () => {
  const imports: string[] = []
  const maybe = toRef(undefined, imports)

  assertEquals(`${maybe}`, '')
  assertEquals(imports, [])
})

Deno.test('build: called once, in the constructor, for a present subject', () => {
  const imports: string[] = []
  const maybe = toRef('Pet', imports)

  assertEquals(imports, ['Pet'])
  assertEquals(`${maybe}${maybe}`, 'PetPet')
  assertEquals(imports, ['Pet'])
})

// --- Example 5: a Loop subject filled after construction --------------------
// An accumulator's Loop may receive items during the generate phase, after the
// Maybe around it is built. Its emptiness is only decided at render.

Deno.test('loop subject: filled after construction renders', () => {
  const routes = new Loop<string>([], { separator: ',\n' })
  const handlers = new Maybe(routes, loop => new Wrap(['export const handlers = [\n', loop, '\n]']))

  routes.add('http.get("/pets", getPets)').add('http.post("/pets", addPet)')

  assertEquals(
    `${handlers}`,
    'export const handlers = [\nhttp.get("/pets", getPets),\nhttp.post("/pets", addPet)\n]'
  )
})

Deno.test('loop subject: never filled renders nothing', () => {
  const routes = new Loop<string>([], { separator: ',\n' })
  const handlers = new Maybe(routes, loop => new Wrap(['export const handlers = [\n', loop, '\n]']))

  assertEquals(`${handlers}`, '')
})

// --- Example 6: a condition is Maybe.when -----------------------------------
// fp-ts `boolean.match`. `false` is a value, not an absence, so a condition
// goes through `when` rather than the constructor.

Deno.test('when: false skips build, true builds', () => {
  const pagination = 'paginate={true}'

  assertEquals(`${Maybe.when(false, () => pagination)}`, '')
  assertEquals(`${Maybe.when(true, () => pagination)}`, 'paginate={true}')
})

// --- Example 6b: '', false and 0 are values ---------------------------------
// fp-ts `O.fromNullable`: only undefined and null are absent. Data that must
// render (`default: false`, `title: ""`, `minimum: 0`) renders.

const toDefault = (value: boolean | undefined) =>
  new Maybe(value, v => new Wrap(['default: `', String(v), '`']))
const toFrontmatterTitle = (value: string | undefined) =>
  new Maybe(value, v => new Wrap(['title: "', v, '"']))

Deno.test('fromNullable: empty and falsy values render', () => {
  assertEquals(`${toDefault(false)}`, 'default: `false`')
  assertEquals(`${toDefault(undefined)}`, '')
  assertEquals(`${toFrontmatterTitle('')}`, 'title: ""')
  assertEquals(`${toFrontmatterTitle(undefined)}`, '')
})

// --- Example 7: absence propagates through every layer ----------------------

Deno.test('absence: Loop skips absent items and keeps empty values', () => {
  const loop = new Loop<Stringable>([
    'a',
    new Nothing(),
    new Loop([]),
    new Maybe(undefined),
    new Maybe(new Loop([new Nothing()])),
    undefined,
    '',
    'b'
  ])

  // fp-ts `A.compact`: absent items go, '' is a value and keeps its separator.
  assertEquals(`${loop}`, 'a, , b')
  assertEquals(new Loop([new Nothing(), new Maybe(undefined)]).isEmpty(), true)
})

// --- Example 8: build narrows its argument ----------------------------------
// `title` is `string` inside build, not `string | undefined`: no `!`, no `as`.

const toTitle = (title: string | undefined): Maybe<string, Wrap> =>
  new Maybe(title, present => new Wrap(['# ', present.toUpperCase()]))

Deno.test('build: argument is narrowed to the present type', () => {
  assertEquals(`${toTitle('pets')}`, '# PETS')
  assertEquals(`${toTitle(undefined)}`, '')
})

// --- Example 9: the two-way form (otherwise) --------------------------------
// fp-ts `fold`: one branch when present, another when absent. Only the branch
// that is needed is built.

type TypeRefArgs = { type: string; anchor: string | undefined }

class TypeRef implements Stringable {
  ref: Maybe<string, Wrap, Wrap>

  constructor({ type, anchor }: TypeRefArgs) {
    this.ref = new Maybe(
      anchor,
      a => new Wrap(['[`', type, '`](#', a, ')']),
      () => new Wrap(['`', type, '`'])
    )
  }

  toString(): string {
    return `${this.ref}`
  }
}

Deno.test('otherwise: renders the present branch or the fallback', () => {
  assertEquals(`${new TypeRef({ type: 'Pet', anchor: 'pet' })}`, '[`Pet`](#pet)')
  assertEquals(`${new TypeRef({ type: 'string', anchor: undefined })}`, '`string`')
})

Deno.test('otherwise: only the needed branch is built', () => {
  const imports: string[] = []
  const toLazy = (recursive: boolean) =>
    Maybe.when(
      recursive,
      () => new Registered({ name: 'z.lazy(() => Pet)', imports }),
      () => new Registered({ name: 'Pet', imports })
    )

  assertEquals(`${toLazy(true)}`, 'z.lazy(() => Pet)')
  assertEquals(`${toLazy(false)}`, 'Pet')
  assertEquals(imports, ['z.lazy(() => Pet)', 'Pet'])
})

Deno.test('otherwise: a Loop subject still empty at render renders the fallback', () => {
  const schemes = new Loop<string>([], { separator: ', ' })
  const auth = new Maybe(
    schemes,
    loop => new Wrap(['Auth: ', loop]),
    () => '_no authentication_'
  )

  assertEquals(`${auth}`, '_no authentication_')
  schemes.add('bearer')
  assertEquals(`${auth}`, 'Auth: bearer')
})

// --- Example 10: a non-empty list is Maybe.nonEmpty -------------------------
// fp-ts `NEA.fromArray`. `build` receives the list typed as non-empty, so
// destructuring the first item needs no check.

const toParameters = (names: string[]): Maybe<true, Wrap> =>
  Maybe.nonEmpty(
    names,
    ([first, ...rest]) => new Wrap(['Parameters: ', new Loop([first, ...rest])])
  )

Deno.test('nonEmpty: an empty list builds nothing, a non-empty one is typed non-empty', () => {
  assertEquals(`${toParameters([])}`, '')
  assertEquals(`${toParameters(['id', 'name'])}`, 'Parameters: id, name')
  assertEquals(`${new Maybe<string[], string>([], items => `count: ${items.length}`)}`, 'count: 0')
})

// --- Example 11: the parent decides presence --------------------------------
// The child always renders; it has no Maybe of its own and no `content` field
// for parents to read. The parent keys a Maybe on the source data.

type NameArgs = { name: string }

class Name implements Stringable {
  name: string

  constructor({ name }: NameArgs) {
    this.name = name
  }

  toString(): string {
    return `**${this.name}**`
  }
}

type FieldArgs = { name: string | undefined; description: string | undefined }

class Field implements Stringable {
  parts: Loop

  constructor({ name, description }: FieldArgs) {
    this.parts = new Loop(
      [new Maybe(name, present => new Name({ name: present })), new Maybe(description)],
      { separator: ' ' }
    )
  }

  toString(): string {
    return `${this.parts}`
  }
}

Deno.test('parent decides: an absent child is never built and leaves no separator', () => {
  assertEquals(`${new Field({ name: 'id', description: 'The pet id' })}`, '**id** The pet id')
  assertEquals(`${new Field({ name: undefined, description: 'The pet id' })}`, 'The pet id')
})

// --- Example 12: real variants use a flat switch ----------------------------
// Several optional parts that combine into different outputs are variants,
// not absence. A flat `switch (true)` narrows in each case; no nested
// ternaries and no ts-pattern in core.

type ZodObjectShapeArgs = {
  objectProperties: Stringable | null
  recordProperties: Stringable | null
}

class ZodObjectShape implements Stringable {
  content: Stringable

  constructor({ objectProperties, recordProperties }: ZodObjectShapeArgs) {
    switch (true) {
      case objectProperties !== null && recordProperties !== null:
        this.content = new Wrap([objectProperties, '.and(', recordProperties, ')'])
        break
      case objectProperties !== null:
        this.content = objectProperties
        break
      case recordProperties !== null:
        this.content = recordProperties
        break
      default:
        this.content = 'z.object({})'
    }
  }

  toString(): string {
    return `${this.content}`
  }
}

Deno.test('switch: each object shape renders its variant', () => {
  const props = 'z.object({id: z.string()})'
  const record = 'z.record(z.string(), z.number())'

  assertEquals(
    `${new ZodObjectShape({ objectProperties: props, recordProperties: record })}`,
    `${props}.and(${record})`
  )
  assertEquals(`${new ZodObjectShape({ objectProperties: props, recordProperties: null })}`, props)
  assertEquals(
    `${new ZodObjectShape({ objectProperties: null, recordProperties: record })}`,
    record
  )
  assertEquals(
    `${new ZodObjectShape({ objectProperties: null, recordProperties: null })}`,
    'z.object({})'
  )
})

// --- Example 13: a value that must also pass a test is Maybe.fromPredicate ---
// fp-ts `O.fromPredicate`. `Maybe.when(min !== undefined && min > 0, …)` cannot
// narrow `min` inside build; `fromPredicate` hands build the present value.

const toMinLength = (minLength: number | undefined) =>
  Maybe.fromPredicate(
    minLength,
    value => value > 0,
    value => new ZodConstraint({ name: 'min', value })
  )

Deno.test('fromPredicate: builds only for a present value that passes', () => {
  assertEquals(`${toMinLength(3)}`, '.min(3)')
  assertEquals(`${toMinLength(0)}`, '')
  assertEquals(`${toMinLength(undefined)}`, '')
})

// --- Example 14: nonEmpty and nonEmptyText without build ---------------------

Deno.test('nonEmptyText: without build renders the text itself', () => {
  const format: string | undefined = ['date-time', undefined][0]
  assertEquals(`${Maybe.nonEmptyText(format)}`, 'date-time')
  assertEquals(`${Maybe.nonEmptyText('')}`, '')
  assertEquals(`${new Loop([Maybe.nonEmptyText(''), 'nullable'], { separator: ' ' })}`, 'nullable')
})

Deno.test('nonEmpty: without build renders the list itself', () => {
  assertEquals(`${Maybe.nonEmpty(['a', 'b'])}`, 'a,b')
  assertEquals(`${Maybe.nonEmpty([])}`, '')
})

// --- Example 15: a data class made of optional parts is a Group --------------
// The instance models the schema: each constraint is a field holding data
// (`Constraint { keyword, value }`), not text. `parts` lists the rendered
// fields once; the framework reads it to tell whether the instance is empty,
// so the parenthetical in the parent drops out without the parent looking in.

type ConstraintKeyword = 'minLength' | 'maxLength' | 'pattern' | 'default'

const LABELS: Record<ConstraintKeyword, string> = {
  minLength: 'min length',
  maxLength: 'max length',
  pattern: 'pattern',
  default: 'default'
}

type CodeArgs = { value: Stringable }

class Code implements Stringable {
  value: Stringable

  constructor({ value }: CodeArgs) {
    this.value = value
  }

  toString(): string {
    return `\`${this.value}\``
  }
}

type KeywordConstraintArgs = { keyword: ConstraintKeyword; value: Stringable }

class Constraint implements Stringable {
  keyword: ConstraintKeyword
  value: Stringable

  constructor({ keyword, value }: KeywordConstraintArgs) {
    this.keyword = keyword
    this.value = value
  }

  toString(): string {
    return `${LABELS[this.keyword]}: ${this.value}`
  }
}

type StringSchema = { minLength?: number; maxLength?: number; pattern?: string; default?: string }

type StringSchemaArgs = { schema: StringSchema }

class StringConstraints extends Group {
  minLength: Maybe<number, Constraint>
  maxLength: Maybe<number, Constraint>
  pattern: Maybe<string, Constraint>
  default: Maybe<string, Constraint>

  constructor({ schema }: StringSchemaArgs) {
    super()
    this.minLength = new Maybe(
      schema.minLength,
      value => new Constraint({ keyword: 'minLength', value })
    )
    this.maxLength = new Maybe(
      schema.maxLength,
      value => new Constraint({ keyword: 'maxLength', value })
    )
    this.pattern = new Maybe(
      schema.pattern,
      value => new Constraint({ keyword: 'pattern', value: new Code({ value }) })
    )
    this.default = new Maybe(
      schema.default,
      value => new Constraint({ keyword: 'default', value: new Code({ value }) })
    )
    this.parts = new Loop([this.minLength, this.maxLength, this.pattern, this.default], {
      separator: ', '
    })
  }
}

class StringTypeInfo implements Stringable {
  parts: Loop

  constructor({ schema }: StringSchemaArgs) {
    const constraints = new StringConstraints({ schema })
    this.parts = new Loop(['`string`', new Maybe(constraints, c => new Wrap(['(', c, ')']))], {
      separator: ' '
    })
  }

  toString(): string {
    return `${this.parts}`
  }
}

Deno.test('group: a data class renders its parts and is empty when they are', () => {
  assertEquals(
    `${new StringTypeInfo({ schema: { minLength: 3, pattern: '^a' } })}`,
    '`string` (min length: 3, pattern: `^a`)'
  )
  assertEquals(`${new StringTypeInfo({ schema: {} })}`, '`string`')
  assertEquals(`${new StringTypeInfo({ schema: { default: '' } })}`, '`string` (default: ``)')
})

Deno.test('group: the data stays readable as data', () => {
  const constraints = new StringConstraints({ schema: { minLength: 3 } })

  // `value` is typed `Constraint | number`: without `build` the value is the
  // subject itself, and a class cannot type that per call. Reading the data
  // back takes a narrowing step.
  const minLength = constraints.minLength.value
  assertEquals(minLength instanceof Constraint ? minLength.keyword : undefined, 'minLength')
  assertEquals(constraints.maxLength.isNothing(), true)
})

// --- Example 16: the subject can be any type ---------------------------------

Deno.test('subject: unknown data renders once undefined and null are removed', () => {
  const toDefault = (value: unknown) =>
    new Maybe(
      value,
      present => new Constraint({ keyword: 'default', value: new Code({ value: present }) })
    )

  assertEquals(`${toDefault(false)}`, 'default: `false`')
  assertEquals(`${toDefault(null)}`, '')
})
