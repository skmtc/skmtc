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

Deno.test('toModelEntry - toPreviewModule is undefined when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.toPreviewModule, undefined)
})

Deno.test('toModelEntry - toMappingModule is undefined when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.toMappingModule, undefined)
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

Deno.test('toModelEntry - includes toMappingModule when provided', () => {
  const mappingFn = () => ({
    name: 'mapping',
    exportPath: './mapping.ts',
    itemType: 'input' as const,
    schema: {} as any,
    group: 'forms' as const,
    items: []
  })

  const entry = toModelEntry({
    id: 'test-model',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    toMappingModule: mappingFn
  })

  assertEquals(entry.toMappingModule, mappingFn)
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
  const mappingFn = () => ({
    name: 'mapping',
    exportPath: './mapping.ts',
    itemType: 'input' as const,
    schema: {} as any,
    group: 'forms' as const,
    items: []
  })
  const enrichmentSchemaFn = () => emptyEnrichmentSchema
  const enrichmentRequestFn = () => undefined

  const entry = toModelEntry({
    id: 'test-model',
    transform: transformFn,
    toPreviewModule: previewFn,
    toMappingModule: mappingFn,
    toEnrichmentSchema: enrichmentSchemaFn,
    toEnrichmentRequest: enrichmentRequestFn
  })

  assertEquals(entry.id, 'test-model')
  assertEquals(entry.type, 'model')
  assertEquals(entry.transform, transformFn)
  assertEquals(entry.toPreviewModule, previewFn)
  assertEquals(entry.toMappingModule, mappingFn)
  assertEquals(entry.toEnrichmentSchema, enrichmentSchemaFn)
  assertEquals(entry.toEnrichmentRequest, enrichmentRequestFn)
})
