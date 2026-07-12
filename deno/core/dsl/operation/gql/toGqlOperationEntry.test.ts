import { toGqlOperationEntry } from './toGqlOperationEntry.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { OasString } from '@/oas/string/String.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'

const createMockGqlOperation = () =>
  new GqlOperation({
    rootKind: 'query',
    fieldName: 'test',
    arguments: [],
    returnType: new OasString({})
  })

Deno.test('toGqlOperationEntry - returns object with id and type operation', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.id, 'test-operation')
  assertEquals(entry.type, 'gqlOperation')
})

Deno.test('toGqlOperationEntry - includes provided transform function', () => {
  let callCount = 0
  const transformFn = () => {
    callCount = callCount + 1
  }
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: transformFn,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.transform, transformFn)
  const mockOperation = createMockGqlOperation()
  entry.transform({
    context: {} as GenerateContextType,
    operation: mockOperation,
    variant: 'main'
  })
  assertEquals(callCount, 1)
})

Deno.test('toGqlOperationEntry - isSupported defaults to true when not provided', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = createMockGqlOperation()

  const result = entry.isSupported({
    context: { settings: {} } as GenerateContextType,
    operation: mockOperation,
    variant: 'main'
  })

  assertEquals(result, true)
})

Deno.test('toGqlOperationEntry - toPreviewModule is undefined when not provided', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.toPreviewModule, undefined)
})

Deno.test('toGqlOperationEntry - toEnrichmentSchema is passed through from config', () => {
  const enrichmentSchemaFn = () => emptyEnrichmentSchema
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: enrichmentSchemaFn
  })

  assertEquals(entry.toEnrichmentSchema, enrichmentSchemaFn)
})

Deno.test('toGqlOperationEntry - toEnrichmentRequest is undefined when not provided', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.toEnrichmentRequest, undefined)
})

Deno.test('toGqlOperationEntry - includes toPreviewModule when provided', () => {
  const previewFn = () => ({
    name: 'test',
    exportPath: './preview.ts',
    group: 'forms' as const,
    title: 'Test Operation',
    description: 'A test operation'
  })

  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    toPreviewModule: previewFn
  })

  assertEquals(entry.toPreviewModule, previewFn)
})

Deno.test('toGqlOperationEntry - includes all optional functions when provided', () => {
  const transformFn = () => {}
  const previewFn = () => ({
    name: 'test',
    exportPath: './preview.ts',
    group: 'forms' as const,
    title: 'Test',
    description: 'Test'
  })
  const isSupportedFn = () => true
  const enrichmentRequestFn = () => undefined

  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: transformFn,
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    toPreviewModule: previewFn,
    isSupported: isSupportedFn,
    toEnrichmentRequest: enrichmentRequestFn
  })

  assertEquals(entry.id, 'test-operation')
  assertEquals(entry.type, 'gqlOperation')
  assertEquals(entry.transform, transformFn)
  assertEquals(entry.toPreviewModule, previewFn)
  assertEquals(entry.toEnrichmentRequest, enrichmentRequestFn)
})
