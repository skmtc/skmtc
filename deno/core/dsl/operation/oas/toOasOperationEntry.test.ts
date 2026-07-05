import { toOasOperationEntry } from './toOasOperationEntry.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'

Deno.test('toOasOperationEntry - returns object with id and type operation', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.id, 'test-operation')
  assertEquals(entry.type, 'oasOperation')
})

Deno.test('toOasOperationEntry - includes provided transform function', () => {
  let callCount = 0
  const transformFn = () => {
    callCount = callCount + 1
  }
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: transformFn,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.transform, transformFn)
  // Verify transform actually works
  const mockOperation = new OasOperation({
    path: '/test',
    method: 'get',
    pathItem: undefined,
    responses: {}
  })
  entry.transform({
    context: {} as GenerateContextType,
    operation: mockOperation,
    variant: 'main'
  })
  assertEquals(callCount, 1)
})

Deno.test('toOasOperationEntry - isSupported defaults to true when not provided', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = new OasOperation({
    path: '/test',
    method: 'get',
    pathItem: undefined,
    responses: {}
  })

  const result = entry.isSupported({
    context: { settings: {} } as GenerateContextType,
    operation: mockOperation,
    variant: 'main'
  })

  assertEquals(result, true)
})

Deno.test('toOasOperationEntry - toPreviewModule is undefined when not provided', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.toPreviewModule, undefined)
})


Deno.test('toOasOperationEntry - toEnrichmentSchema reflects the provided schema', () => {
  const enrichmentSchemaFn = () => emptyEnrichmentSchema
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: enrichmentSchemaFn
  })

  assertEquals(entry.toEnrichmentSchema, enrichmentSchemaFn)
})

Deno.test('toOasOperationEntry - toEnrichmentRequest is undefined when not provided', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.toEnrichmentRequest, undefined)
})

Deno.test('toOasOperationEntry - includes toPreviewModule when provided', () => {
  const previewFn = () => ({
    name: 'test',
    exportPath: './preview.ts',
    group: 'forms' as const,
    title: 'Test Operation',
    description: 'A test operation'
  })

  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    toPreviewModule: previewFn
  })

  assertEquals(entry.toPreviewModule, previewFn)
})


Deno.test('toOasOperationEntry - includes all optional functions when provided', () => {
  const transformFn = () => {}
  const previewFn = () => ({
    name: 'test',
    exportPath: './preview.ts',
    group: 'forms' as const,
    title: 'Test',
    description: 'Test'
  })
  const isSupportedFn = () => true
  const enrichmentSchemaFn = () => emptyEnrichmentSchema
  const enrichmentRequestFn = () => undefined

  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: transformFn,
    toEnrichmentSchema: enrichmentSchemaFn,
    toPreviewModule: previewFn,
    isSupported: isSupportedFn,
    toEnrichmentRequest: enrichmentRequestFn
  })

  assertEquals(entry.id, 'test-operation')
  assertEquals(entry.type, 'oasOperation')
  assertEquals(entry.transform, transformFn)
  assertEquals(entry.toEnrichmentSchema, enrichmentSchemaFn)
  assertEquals(entry.toPreviewModule, previewFn)
  assertEquals(entry.toEnrichmentRequest, enrichmentRequestFn)
})
