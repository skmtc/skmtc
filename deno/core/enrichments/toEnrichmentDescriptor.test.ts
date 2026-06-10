import { assertEquals } from '@std/assert'
import * as v from 'valibot'
import { moduleExport } from '@/types/ModuleExport.ts'
import { accessorPath } from '@/types/AccessorPath.ts'
import {
  toEnrichmentDescriptor,
  toEnrichmentFields,
  type EnrichmentSource
} from './toEnrichmentDescriptor.ts'

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

Deno.test('toEnrichmentDescriptor — derives generator and appliesTo from an OAS-operation entry', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-shadcn-form',
    type: 'oasOperation',
    toEnrichmentSchema: () => v.optional(
      v.object({ title: v.optional(v.string()) })
    )
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-shadcn-form',
    appliesTo: 'operation',
    fields: [{ key: 'title', label: 'Title', optional: true, kind: 'text' }]
  })
})

Deno.test('toEnrichmentDescriptor — collapses gqlOperation to operation', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-reapit-form',
    type: 'gqlOperation',
    toEnrichmentSchema: () => v.object({ title: v.optional(v.string()) })
  }
  const descriptor = toEnrichmentDescriptor(entry)
  assertEquals(descriptor.appliesTo, 'operation')
})

Deno.test('toEnrichmentDescriptor — model entry yields appliesTo: model', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-zod',
    type: 'model',
    toEnrichmentSchema: () => v.optional(
      v.object({ description: v.optional(v.string()), strict: v.optional(v.boolean()) })
    )
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-zod',
    appliesTo: 'model',
    fields: [
      { key: 'description', label: 'Description', optional: true, kind: 'text' },
      { key: 'strict', label: 'Strict', optional: true, kind: 'toggle' }
    ]
  })
})

Deno.test('toEnrichmentDescriptor — entry without toEnrichmentSchema yields empty fields', () => {
  const entry: EnrichmentSource = {
    id: '@skmtc/gen-bare',
    type: 'oasOperation'
  }
  assertEquals(toEnrichmentDescriptor(entry), {
    generator: '@skmtc/gen-bare',
    appliesTo: 'operation',
    fields: []
  })
})

Deno.test('toEnrichmentDescriptor — gen-shadcn-form realistic shape', () => {
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
    toEnrichmentSchema: () => v.optional(
      v.object({
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        submitLabel: v.optional(v.string()),
        fields: v.optional(v.array(formFieldItem))
      })
    )
  }
  const descriptor = toEnrichmentDescriptor(entry)

  assertEquals(descriptor.generator, '@skmtc/gen-shadcn-form')
  assertEquals(descriptor.appliesTo, 'operation')
  assertEquals(descriptor.fields.length, 4)
  assertEquals(descriptor.fields[0], {
    key: 'title',
    label: 'Title',
    optional: true,
    kind: 'text'
  })

  const fieldsArray = descriptor.fields[3]
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
