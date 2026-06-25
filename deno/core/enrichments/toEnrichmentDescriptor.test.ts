import { assertEquals } from '@std/assert'
import * as v from 'valibot'
import { moduleExport } from '@/types/ModuleExport.ts'
import { accessorPath } from '@/types/AccessorPath.ts'
import {
  toEnrichmentDescriptor,
  toEnrichmentFields,
  type EnrichmentSource
} from './toEnrichmentDescriptor.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'

Deno.test('toEnrichmentFields — undefined input yields no fields', () => {
  assertEquals(toEnrichmentFields(undefined), [])
})

Deno.test('toEnrichmentFields — v.undefined yields no fields', () => {
  assertEquals(toEnrichmentFields(v.undefined()), [])
})

Deno.test('toEnrichmentFields — optional-wrapped empty object yields no fields', () => {
  assertEquals(toEnrichmentFields(v.optional(v.object({}))), [])
})

Deno.test('toEnrichmentFields — primitive kinds and optional flag', () => {
  const schema = v.object({
    title: v.optional(v.string()),
    strict: v.boolean(),
    description: v.optional(v.string())
  })
  assertEquals(toEnrichmentFields(schema), [
    { key: 'title', label: 'Title', optional: true, kind: 'text' },
    { key: 'strict', label: 'Strict', optional: false, kind: 'toggle' },
    { key: 'description', label: 'Description', optional: true, kind: 'text' }
  ])
})

Deno.test('toEnrichmentFields — picklist becomes select with options', () => {
  const schema = v.object({
    layout: v.picklist(['stacked', 'inline'])
  })
  assertEquals(toEnrichmentFields(schema), [
    { key: 'layout', label: 'Layout', optional: false, kind: 'select', options: ['stacked', 'inline'] }
  ])
})

Deno.test('toEnrichmentFields — moduleExport identity-matches to module kind', () => {
  const schema = v.object({ input: v.optional(moduleExport) })
  assertEquals(toEnrichmentFields(schema), [
    { key: 'input', label: 'Input', optional: true, kind: 'module' }
  ])
})

Deno.test('toEnrichmentFields — accessorPath identity-matches to accessorPath kind', () => {
  const schema = v.object({ accessorPath: v.optional(accessorPath) })
  assertEquals(toEnrichmentFields(schema), [
    { key: 'accessorPath', label: 'Accessor Path', optional: true, kind: 'accessorPath' }
  ])
})

Deno.test('toEnrichmentFields — array of objects yields one-element item with nested fields', () => {
  const schema = v.object({
    fields: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.optional(v.string())
        })
      )
    )
  })
  assertEquals(toEnrichmentFields(schema), [
    {
      key: 'fields',
      label: 'Fields',
      optional: true,
      kind: 'array',
      item: [
        {
          key: '',
          label: '',
          optional: false,
          kind: 'object',
          fields: [
            { key: 'id', label: 'Id', optional: false, kind: 'text' },
            { key: 'label', label: 'Label', optional: true, kind: 'text' }
          ]
        }
      ]
    }
  ])
})

Deno.test('toEnrichmentFields — omits object members that unwrap to v.undefined', () => {
  const schema = v.object({
    present: v.string(),
    absent: v.undefined()
  })
  assertEquals(toEnrichmentFields(schema), [
    { key: 'present', label: 'Present', optional: false, kind: 'text' }
  ])
})

Deno.test('toEnrichmentDescriptor — surfaces the subject scope of the umbrella (OAS operation)', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-shadcn-form',
    type: 'oasOperation',
    toEnrichmentSchema: () => v.object({
      subject: v.optional(v.object({ title: v.optional(v.string()) })),
      generator: v.undefined(),
      stack: v.undefined()
    })
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-shadcn-form',
    subjectKind: 'operation',
    supportsVariant: false,
    fields: [
      {
        key: 'subject',
        label: 'Subject',
        optional: true,
        kind: 'object',
        fields: [{ key: 'title', label: 'Title', optional: true, kind: 'text' }]
      }
    ]
  })
})

Deno.test('toEnrichmentDescriptor — collapses gqlOperation to operation', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-reapit-form',
    type: 'gqlOperation',
    toEnrichmentSchema: () => v.object({
      subject: v.optional(v.object({ title: v.optional(v.string()) })),
      generator: v.undefined(),
      stack: v.undefined()
    })
  }
  const descriptor = toEnrichmentDescriptor(entry)
  assertEquals(descriptor.subjectKind, 'operation')
})

Deno.test('toEnrichmentDescriptor — maps webhook to its own subject kind', () => {
  // A webhook generator (type 'webhook') resembles an operation but is a
  // distinct subject (addressed by webhook name, not request path), so its
  // descriptor's subjectKind is 'webhook', not 'operation'.
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-ts-webhook',
    type: 'webhook',
    toEnrichmentSchema: () => v.object({
      subject: v.optional(v.object({ title: v.optional(v.string()) })),
      generator: v.undefined(),
      stack: v.undefined()
    })
  }
  const descriptor = toEnrichmentDescriptor(entry)
  assertEquals(descriptor.subjectKind, 'webhook')
})

Deno.test('toEnrichmentDescriptor — surfaces subject + generator scopes (model entry)', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-kotlin',
    type: 'model',
    toEnrichmentSchema: () => v.object({
      subject: v.optional(v.object({ description: v.optional(v.string()) })),
      generator: v.object({ basePackage: v.string() }),
      stack: v.undefined()
    })
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-kotlin',
    subjectKind: 'model',
    supportsVariant: false,
    fields: [
      {
        key: 'subject',
        label: 'Subject',
        optional: true,
        kind: 'object',
        fields: [{ key: 'description', label: 'Description', optional: true, kind: 'text' }]
      },
      {
        key: 'generator',
        label: 'Generator',
        optional: false,
        kind: 'object',
        fields: [{ key: 'basePackage', label: 'Base Package', optional: false, kind: 'text' }]
      }
    ]
  })
})

Deno.test('toEnrichmentDescriptor — empty umbrella (emptyEnrichmentSchema) yields no fields', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-typescript',
    type: 'model',
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-typescript',
    subjectKind: 'model',
    supportsVariant: false,
    fields: []
  })
})

Deno.test('toEnrichmentDescriptor — entry without toEnrichmentSchema yields empty fields', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-bare',
    type: 'oasOperation'
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-bare',
    subjectKind: 'operation',
    supportsVariant: false,
    fields: []
  })
})

Deno.test('toEnrichmentDescriptor — surfaces an entry that declares variant support', () => {
  const entry: EnrichmentSource = {
    id: '@reapit/gen-elemental-form',
    type: 'oasOperation',
    supportsVariant: () => true,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }
  assertEquals(toEnrichmentDescriptor(entry).supportsVariant, true)
})

Deno.test('toEnrichmentDescriptor — defaults supportsVariant to false when the entry omits it', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-typescript',
    type: 'model'
  }
  assertEquals(toEnrichmentDescriptor(entry).supportsVariant, false)
})

Deno.test('toEnrichmentDescriptor — gen-shadcn-form realistic subject leaf', () => {
  const formFieldItem = v.object({
    id: v.string(),
    accessorPath: v.optional(accessorPath),
    input: v.optional(moduleExport),
    label: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    references: v.optional(v.string())
  })
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-shadcn-form',
    type: 'oasOperation',
    toEnrichmentSchema: () => v.object({
      subject: v.optional(
        v.object({
          title: v.optional(v.string()),
          description: v.optional(v.string()),
          submitLabel: v.optional(v.string()),
          fields: v.optional(v.array(formFieldItem))
        })
      ),
      generator: v.undefined(),
      stack: v.undefined()
    })
  }
  const descriptor = toEnrichmentDescriptor(entry)

  assertEquals(descriptor.generator, '@skmtc/gen-shadcn-form')
  assertEquals(descriptor.subjectKind, 'operation')
  // The umbrella surfaces a single `subject` scope; the form leaf is nested.
  assertEquals(descriptor.fields.length, 1)
  const subject = descriptor.fields[0]
  assertEquals(subject.key, 'subject')
  assertEquals(subject.kind, 'object')

  const subjectFields = subject.fields ?? []
  assertEquals(subjectFields.length, 4)
  assertEquals(subjectFields[0], {
    key: 'title',
    label: 'Title',
    optional: true,
    kind: 'text'
  })

  const fieldsArray = subjectFields[3]
  assertEquals(fieldsArray.kind, 'array')
  assertEquals(fieldsArray.optional, true)
  const itemFields = fieldsArray.item?.[0]?.fields ?? []
  const byKey = Object.fromEntries(itemFields.map(f => [f.key, f.kind]))
  assertEquals(byKey, {
    id: 'text',
    accessorPath: 'accessorPath',
    input: 'module',
    label: 'text',
    placeholder: 'text',
    references: 'text'
  })
})
