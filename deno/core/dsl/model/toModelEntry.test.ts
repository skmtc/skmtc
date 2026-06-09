import { typescript } from '@skmtc/lang-typescript'
import { toModelEntry } from './toModelEntry.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'

Deno.test('toModelEntry - returns object with id and type model', () => {
  const entry = toModelEntry({
    id: 'test-model',
    lang: typescript,
    transform: ({ acc }) => acc
  })

  assertEquals(entry.id, 'test-model')
  assertEquals(entry.type, 'model')
})

Deno.test('toModelEntry - includes provided transform function', () => {
  const transformFn = ({ acc }: { acc: number | undefined }) => (acc ?? 0) + 1
  const entry = toModelEntry({
    id: 'test-model',
    lang: typescript,
    transform: transformFn
  })

  assertEquals(entry.transform, transformFn)
  // Verify transform actually works
  const result = entry.transform({
    context: {} as GenerateContextType,
    refName: 'Test' as RefName,
    acc: 5,
    variant: 'main'
  })
  assertEquals(result, 6)
})

Deno.test('toModelEntry - toPreviewModule is undefined when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    lang: typescript,
    transform: ({ acc }) => acc
  })

  assertEquals(entry.toPreviewModule, undefined)
})

Deno.test('toModelEntry - toMappingModule is undefined when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    lang: typescript,
    transform: ({ acc }) => acc
  })

  assertEquals(entry.toMappingModule, undefined)
})

Deno.test('toModelEntry - toEnrichmentSchema is undefined when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    lang: typescript,
    transform: ({ acc }) => acc
  })

  assertEquals(entry.toEnrichmentSchema, undefined)
})

Deno.test('toModelEntry - toEnrichmentRequest is undefined when not provided', () => {
  const entry = toModelEntry({
    id: 'test-model',
    lang: typescript,
    transform: ({ acc }) => acc
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
    lang: typescript,
    transform: ({ acc }) => acc,
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
    lang: typescript,
    transform: ({ acc }) => acc,
    toMappingModule: mappingFn
  })

  assertEquals(entry.toMappingModule, mappingFn)
})

Deno.test('toModelEntry - includes all optional functions when provided', () => {
  const transformFn = ({ acc }: { acc: string | undefined }) => acc ?? 'default'
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
  const enrichmentSchemaFn = () => ({ kind: 'schema' } as any)
  const enrichmentRequestFn = () => undefined

  const entry = toModelEntry({
    id: 'test-model',
    lang: typescript,
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
