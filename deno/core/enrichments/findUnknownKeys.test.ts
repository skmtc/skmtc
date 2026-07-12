import { assertEquals } from '@std/assert'
import * as v from 'valibot'
import { findUnknownKeys } from './findUnknownKeys.ts'
import { lensInputModuleType, moduleSelect } from '@/types/ModuleSelect.ts'

const leafSchema = v.object({
  title: v.optional(v.string()),
  submitLabel: v.optional(v.string()),
  fields: v.optional(
    v.array(
      v.object({
        id: v.string(),
        label: v.optional(v.string())
      })
    )
  )
})

Deno.test('findUnknownKeys - declared keys produce nothing', () => {
  const value = { title: 'Edit', fields: [{ id: 'name', label: 'Name' }] }
  assertEquals(findUnknownKeys(leafSchema, value), [])
})

Deno.test('findUnknownKeys - misspelled optional key is reported with a suggestion', () => {
  const value = { submitLabl: 'Save' }
  assertEquals(findUnknownKeys(leafSchema, value), [
    { path: ['submitLabl'], suggestion: 'submitLabel' }
  ])
})

Deno.test('findUnknownKeys - unknown key without a close match has no suggestion', () => {
  const value = { totallyUnrelated: true }
  assertEquals(findUnknownKeys(leafSchema, value), [{ path: ['totallyUnrelated'] }])
})

Deno.test('findUnknownKeys - nested unknown key inside an array element is reported by index', () => {
  const value = { fields: [{ id: 'name' }, { id: 'age', labl: 'Age' }] }
  assertEquals(findUnknownKeys(leafSchema, value), [
    { path: ['fields', '1', 'labl'], suggestion: 'label' }
  ])
})

Deno.test('findUnknownKeys - optional wrapper is unwrapped before walking', () => {
  const schema = v.optional(leafSchema)
  assertEquals(findUnknownKeys(schema, { tilte: 'x' }), [{ path: ['tilte'], suggestion: 'title' }])
})

Deno.test('findUnknownKeys - undefined and null values produce nothing', () => {
  assertEquals(findUnknownKeys(leafSchema, undefined), [])
  assertEquals(findUnknownKeys(leafSchema, null), [])
})

Deno.test('findUnknownKeys - record schemas admit any key and walk values', () => {
  const schema = v.record(v.string(), v.object({ enabled: v.boolean() }))
  const value = { anything: { enabled: true }, other: { enbled: false } }
  assertEquals(findUnknownKeys(schema, value), [
    { path: ['other', 'enbled'], suggestion: 'enabled' }
  ])
})

Deno.test('findUnknownKeys - piped object schema still walks its entries', () => {
  // `v.pipe(base, v.title(...))` spreads the base schema, so entries stay
  // visible — piping metadata must not disable the check.
  const schema = v.object({
    moduleSelect: v.optional(v.pipe(moduleSelect(lensInputModuleType), v.title('Input'))),
    label: v.optional(v.string())
  })
  assertEquals(findUnknownKeys(schema, { labl: 'x' }), [{ path: ['labl'], suggestion: 'label' }])
  // Keys the moduleSelect schema declares pass through the pipe untouched.
  assertEquals(
    findUnknownKeys(schema, {
      moduleSelect: { schemaPath: ['RequestBody', 'officeIds'] }
    }),
    []
  )
})

Deno.test('findUnknownKeys - unions are left alone (fail-open)', () => {
  const schema = v.object({
    choice: v.optional(v.union([v.object({ a: v.string() }), v.object({ b: v.string() })]))
  })
  assertEquals(findUnknownKeys(schema, { choice: { c: 'x' } }), [])
})

Deno.test("findUnknownKeys - wrong-typed values are not this check's concern", () => {
  // A string where an object is declared: v.parse throws for this
  // elsewhere; the key walk stays silent.
  assertEquals(findUnknownKeys(leafSchema, { fields: 'not-an-array' }), [])
})
