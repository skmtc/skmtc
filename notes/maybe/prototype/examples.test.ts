import { assertEquals } from '@std/assert'
import { Loop, Maybe, Nothing, Wrap } from './mod.ts'
import type { Stringable } from './mod.ts'

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
        new Maybe(title, t => new Wrap(['<h2 className="text-2xl font-semibold">', t, '</h2>'])),
        new Maybe(description, d => new Wrap(['<p className="text-muted-foreground">', d, '</p>']))
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

class ZodInteger implements Stringable {
  constraints: Loop

  constructor({ schema }: { schema: IntegerSchema }) {
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

class Registered implements Stringable {
  name: string

  constructor({ name, imports }: { name: string; imports: string[] }) {
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

// --- Example 6: boolean subject ----------------------------------------------

Deno.test('boolean subject: false skips build, true builds', () => {
  const pagination = 'paginate={true}'

  assertEquals(`${new Maybe(false, () => pagination)}`, '')
  assertEquals(`${new Maybe(true, () => pagination)}`, 'paginate={true}')
})

// --- Example 7: absence propagates through every layer ----------------------

Deno.test('absence: Nothing, empty Loops and empty Maybes are skipped by Loop', () => {
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

  assertEquals(`${loop}`, 'a, b')
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
