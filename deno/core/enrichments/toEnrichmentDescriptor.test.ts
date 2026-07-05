import { assertEquals } from '@std/assert'
import * as v from 'valibot'
import { moduleExport } from '@/types/ModuleExport.ts'
import { lensInputModuleType, moduleSelect } from '@/types/ModuleSelect.ts'
import { schemaPath } from '@/types/SchemaPath.ts'
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
    { key: 'title', label: 'Title', optional: true, type: 'text' },
    { key: 'strict', label: 'Strict', optional: false, type: 'toggle' },
    { key: 'description', label: 'Description', optional: true, type: 'text' }
  ])
})

Deno.test('toEnrichmentFields — picklist becomes select with options', () => {
  const schema = v.object({
    layout: v.picklist(['stacked', 'inline'])
  })
  assertEquals(toEnrichmentFields(schema), [
    { key: 'layout', label: 'Layout', optional: false, type: 'select', options: ['stacked', 'inline'] }
  ])
})

Deno.test('toEnrichmentFields — standalone moduleExport degrades to a generic object widget', () => {
  // There is no standalone `module` widget: a component reference is only
  // meaningful WITH the path that gives it a type (declare a moduleSelect).
  const schema = v.object({ input: v.optional(moduleExport) })
  assertEquals(toEnrichmentFields(schema), [
    {
      key: 'input',
      label: 'Input',
      optional: true,
      type: 'object',
      fields: [
        { key: 'exportName', label: 'Export Name', optional: false, type: 'text' },
        { key: 'exportPath', label: 'Export Path', optional: false, type: 'text' }
      ]
    }
  ])
})

Deno.test('toEnrichmentFields — standalone schemaPath degrades to a generic array widget', () => {
  const schema = v.object({ schemaPath: v.optional(schemaPath) })
  assertEquals(toEnrichmentFields(schema), [
    {
      key: 'schemaPath',
      label: 'Schema Path',
      optional: true,
      type: 'array',
      item: [{ key: '', label: '', optional: false, type: 'text' }]
    }
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
      type: 'array',
      item: [
        {
          key: '',
          label: '',
          optional: false,
          type: 'object',
          fields: [
            { key: 'id', label: 'Id', optional: false, type: 'text' },
            { key: 'label', label: 'Label', optional: true, type: 'text' }
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
    { key: 'present', label: 'Present', optional: false, type: 'text' }
  ])
})

Deno.test('toEnrichmentDescriptor — surfaces the subject scope of the umbrella (OAS operation)', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-shadcn-form',
    type: 'oasOperation',
    supportsVariant: () => false,
    toEnrichmentSchema: () => v.object({
      subject: v.optional(v.object({ title: v.optional(v.string()) })),
      generator: v.undefined(),
      stack: v.undefined()
    })
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-shadcn-form',
    subjectType: 'operation',
    supportsVariant: false,
    fields: [
      {
        key: 'subject',
        label: 'Subject',
        optional: true,
        type: 'object',
        fields: [{ key: 'title', label: 'Title', optional: true, type: 'text' }]
      }
    ]
  })
})

Deno.test('toEnrichmentDescriptor — collapses gqlOperation to operation', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-reapit-form',
    type: 'gqlOperation',
    supportsVariant: () => false,
    toEnrichmentSchema: () => v.object({
      subject: v.optional(v.object({ title: v.optional(v.string()) })),
      generator: v.undefined(),
      stack: v.undefined()
    })
  }
  const descriptor = toEnrichmentDescriptor(entry)
  assertEquals(descriptor.subjectType, 'operation')
})

Deno.test('toEnrichmentDescriptor — maps webhook to its own subject type', () => {
  // A webhook generator (type 'webhook') resembles an operation but is a
  // distinct subject (addressed by webhook name, not request path), so its
  // descriptor's subjectType is 'webhook', not 'operation'.
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-ts-webhook',
    type: 'webhook',
    supportsVariant: () => false,
    toEnrichmentSchema: () => v.object({
      subject: v.optional(v.object({ title: v.optional(v.string()) })),
      generator: v.undefined(),
      stack: v.undefined()
    })
  }
  const descriptor = toEnrichmentDescriptor(entry)
  assertEquals(descriptor.subjectType, 'webhook')
})

Deno.test('toEnrichmentDescriptor — surfaces subject + generator scopes (model entry)', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-kotlin',
    type: 'model',
    supportsVariant: () => false,
    toEnrichmentSchema: () => v.object({
      subject: v.optional(v.object({ description: v.optional(v.string()) })),
      generator: v.object({ basePackage: v.string() }),
      stack: v.undefined()
    })
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-kotlin',
    subjectType: 'model',
    supportsVariant: false,
    fields: [
      {
        key: 'subject',
        label: 'Subject',
        optional: true,
        type: 'object',
        fields: [{ key: 'description', label: 'Description', optional: true, type: 'text' }]
      },
      {
        key: 'generator',
        label: 'Generator',
        optional: false,
        type: 'object',
        fields: [{ key: 'basePackage', label: 'Base Package', optional: false, type: 'text' }]
      }
    ]
  })
})

Deno.test('toEnrichmentDescriptor — empty umbrella (emptyEnrichmentSchema) yields no fields', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-typescript',
    type: 'model',
    supportsVariant: () => false,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-typescript',
    subjectType: 'model',
    supportsVariant: false,
    fields: []
  })
})

Deno.test('toEnrichmentDescriptor — entry without toEnrichmentSchema yields empty fields', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-bare',
    type: 'oasOperation',
    supportsVariant: () => false
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-bare',
    subjectType: 'operation',
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

Deno.test('toEnrichmentFields — moduleSelect registers with its declared moduleType (lensInputModuleType)', () => {
  const schema = v.object({ moduleSelect: v.optional(moduleSelect(lensInputModuleType)) })
  assertEquals(toEnrichmentFields(schema), [
    {
      key: 'moduleSelect',
      label: 'Module Select',
      optional: true,
      type: 'moduleSelect',
      moduleType: lensInputModuleType
    }
  ])
})

Deno.test('toEnrichmentFields — moduleSelect carries a custom moduleType', () => {
  const cellModuleType = `export type CellModule<F> = (props: { value: F }) => unknown`
  const schema = v.object({ moduleSelect: moduleSelect(cellModuleType) })
  assertEquals(toEnrichmentFields(schema), [
    { key: 'moduleSelect', label: 'Module Select', optional: false, type: 'moduleSelect', moduleType: cellModuleType }
  ])
})

Deno.test('toEnrichmentFields — v.title on a piped moduleSelect becomes the label, identity kept', () => {
  const schema = v.object({
    moduleSelect: v.optional(v.pipe(moduleSelect(lensInputModuleType), v.title('Input')))
  })
  assertEquals(toEnrichmentFields(schema), [
    {
      key: 'moduleSelect',
      label: 'Input',
      optional: true,
      type: 'moduleSelect',
      moduleType: lensInputModuleType
    }
  ])
})

Deno.test('toEnrichmentFields — v.title labels a plain field', () => {
  const schema = v.object({ submitLabel: v.optional(v.pipe(v.string(), v.title('Submit button'))) })
  assertEquals(toEnrichmentFields(schema), [
    { key: 'submitLabel', label: 'Submit button', optional: true, type: 'text' }
  ])
})

Deno.test('toEnrichmentDescriptor — moduleSelect-era form leaf (no id, no sibling path/input)', () => {
  const formFieldItem = v.object({
    moduleSelect: v.optional(v.pipe(moduleSelect(lensInputModuleType), v.title('Input'))),
    label: v.optional(v.string()),
    placeholder: v.optional(v.string())
  })
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-shadcn-form',
    type: 'oasOperation',
    supportsVariant: () => true,
    toEnrichmentSchema: () => v.object({
      subject: v.optional(
        v.object({
          title: v.optional(v.string()),
          fields: v.optional(v.array(formFieldItem))
        })
      ),
      generator: v.undefined(),
      stack: v.undefined()
    })
  }
  const descriptor = toEnrichmentDescriptor(entry)
  const subjectFields = descriptor.fields[0]?.fields ?? []
  const itemFields = subjectFields[1]?.item?.[0]?.fields ?? []
  assertEquals(itemFields, [
    {
      key: 'moduleSelect',
      label: 'Input',
      optional: true,
      type: 'moduleSelect',
      moduleType: lensInputModuleType
    },
    { key: 'label', label: 'Label', optional: true, type: 'text' },
    { key: 'placeholder', label: 'Placeholder', optional: true, type: 'text' }
  ])
})

Deno.test('toEnrichmentDescriptor — legacy sibling-key leaf degrades to generic widgets', () => {
  // The pre-moduleSelect shape: id + sibling schemaPath/input keys. With the
  // standalone widgets removed, the raw schemas degrade to array/object —
  // usable, but visibly signalling the generator should declare moduleSelect.
  const formFieldItem = v.object({
    id: v.string(),
    schemaPath: v.optional(schemaPath),
    input: v.optional(moduleExport),
    label: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    references: v.optional(v.string())
  })
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-shadcn-form',
    type: 'oasOperation',
    supportsVariant: () => false,
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
  assertEquals(descriptor.subjectType, 'operation')
  // The umbrella surfaces a single `subject` scope; the form leaf is nested.
  assertEquals(descriptor.fields.length, 1)
  const subject = descriptor.fields[0]
  assertEquals(subject.key, 'subject')
  assertEquals(subject.type, 'object')

  const subjectFields = subject.fields ?? []
  assertEquals(subjectFields.length, 4)
  assertEquals(subjectFields[0], {
    key: 'title',
    label: 'Title',
    optional: true,
    type: 'text'
  })

  const fieldsArray = subjectFields[3]
  assertEquals(fieldsArray.type, 'array')
  assertEquals(fieldsArray.optional, true)
  const itemFields = fieldsArray.item?.[0]?.fields ?? []
  const byKey = Object.fromEntries(itemFields.map(f => [f.key, f.type]))
  assertEquals(byKey, {
    id: 'text',
    schemaPath: 'array',
    input: 'object',
    label: 'text',
    placeholder: 'text',
    references: 'text'
  })
})
