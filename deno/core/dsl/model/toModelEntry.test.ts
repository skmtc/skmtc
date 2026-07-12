import { toModelEntry } from './toModelEntry.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'

Deno.test('toModelEntry - returns object with id and type model', () => {
  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.id, 'test-model')
  assertEquals(entry.type, 'model')
})

Deno.test('toModelEntry - includes provided transform function', () => {
  let callCount = 0
  const transformFn = () => {
    callCount = callCount + 1
  }
  const entry = toModelEntry({
    id: 'test-model',
    transform: transformFn,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.transform, transformFn)
  // Verify transform actually works
  entry.transform({
    context: {} as GenerateContextType,
    refName: 'Test' as RefName,
    variant: 'main'
  })
  assertEquals(callCount, 1)
})

Deno.test('toModelEntry - isSupported defaults to true when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const result = entry.isSupported({
    context: { settings: {} } as GenerateContextType,
    refName: 'Test' as RefName,
    variant: 'main'
  })

  assertEquals(result, true)
})

Deno.test('toModelEntry - includes provided isSupported and gates on refName', () => {
  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    isSupported: ({ refName }) => refName === 'User'
  })

  const context = { settings: {} } as GenerateContextType
  assertEquals(entry.isSupported({ context, refName: 'User' as RefName, variant: 'main' }), true)
  assertEquals(entry.isSupported({ context, refName: 'Order' as RefName, variant: 'main' }), false)
})

Deno.test('toModelEntry - toPreviewModule is undefined when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.toPreviewModule, undefined)
})

Deno.test('toModelEntry - includes provided toEnrichmentSchema', () => {
  const schemaFn = () => emptyEnrichmentSchema
  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: schemaFn
  })

  assertEquals(entry.toEnrichmentSchema, schemaFn)
})

Deno.test('toModelEntry - toEnrichmentRequest is undefined when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.toEnrichmentRequest, undefined)
})

Deno.test('toModelEntry - includes toPreviewModule when provided', () => {
  const previewFn = () => ({
    name: 'test',
    exportPath: './preview.ts',
    group: 'forms' as const,
    title: 'Test Model',
    description: 'A test model'
  })

  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    toPreviewModule: previewFn
  })

  assertEquals(entry.toPreviewModule, previewFn)
})

Deno.test('toModelEntry - includes all optional functions when provided', () => {
  const transformFn = () => {}
  const previewFn = () => ({
    name: 'test',
    exportPath: './preview.ts',
    group: 'forms' as const,
    title: 'Test',
    description: 'Test'
  })
  const enrichmentSchemaFn = () => emptyEnrichmentSchema
  const enrichmentRequestFn = () => undefined
  const isSupportedFn = () => true

  const entry = toModelEntry({
    id: 'test-model',
    transform: transformFn,
    isSupported: isSupportedFn,
    toPreviewModule: previewFn,
    toEnrichmentSchema: enrichmentSchemaFn,
    toEnrichmentRequest: enrichmentRequestFn
  })

  assertEquals(entry.id, 'test-model')
  assertEquals(entry.type, 'model')
  assertEquals(entry.transform, transformFn)
  assertEquals(entry.toPreviewModule, previewFn)
  assertEquals(entry.toEnrichmentSchema, enrichmentSchemaFn)
  assertEquals(entry.toEnrichmentRequest, enrichmentRequestFn)
})
