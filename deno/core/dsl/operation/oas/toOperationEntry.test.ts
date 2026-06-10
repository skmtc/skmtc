import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'

Deno.test('toOperationEntry - returns object with id and type oasOperation', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {}
  })

  assertEquals(entry.id, 'test-operation')
  assertEquals(entry.type, 'oasOperation')
})

Deno.test('toOperationEntry - includes provided transform function', () => {
  let callCount = 0
  const transformFn = () => {
    callCount = callCount + 1
  }
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: transformFn
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

Deno.test('toOperationEntry - isSupported defaults to true when not provided', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {}
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

Deno.test('toOperationEntry - toPreviewModule is undefined when not provided', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {}
  })

  assertEquals(entry.toPreviewModule, undefined)
})

Deno.test('toOperationEntry - toMappingModule is undefined when not provided', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {}
  })

  assertEquals(entry.toMappingModule, undefined)
})

Deno.test('toOperationEntry - toEnrichmentSchema is undefined when not provided', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {}
  })

  assertEquals(entry.toEnrichmentSchema, undefined)
})

Deno.test('toOperationEntry - toEnrichmentRequest is undefined when not provided', () => {
  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {}
  })

  assertEquals(entry.toEnrichmentRequest, undefined)
})

Deno.test('toOperationEntry - includes toPreviewModule when provided', () => {
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
    toPreviewModule: previewFn
  })

  assertEquals(entry.toPreviewModule, previewFn)
})

Deno.test('toOperationEntry - includes toMappingModule when provided', () => {
  const mappingFn = () => ({
    name: 'mapping',
    exportPath: './mapping.ts',
    itemType: 'input' as const,
    schema: {} as any,
    group: 'forms' as const,
    items: []
  })

  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toMappingModule: mappingFn
  })

  assertEquals(entry.toMappingModule, mappingFn)
})

Deno.test('toOperationEntry - includes all optional functions when provided', () => {
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
  const isSupportedFn = () => true
  const enrichmentRequestFn = () => undefined

  const entry = toOasOperationEntry({
    id: 'test-operation',
    transform: transformFn,
    toPreviewModule: previewFn,
    toMappingModule: mappingFn,
    isSupported: isSupportedFn,
    toEnrichmentRequest: enrichmentRequestFn
  })

  assertEquals(entry.id, 'test-operation')
  assertEquals(entry.type, 'oasOperation')
  assertEquals(entry.transform, transformFn)
  assertEquals(entry.toPreviewModule, previewFn)
  assertEquals(entry.toMappingModule, mappingFn)
  assertEquals(entry.toEnrichmentRequest, enrichmentRequestFn)
})
