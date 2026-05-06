import { toGqlOperationEntry } from './toOperationEntry.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { OasString } from '@/oas/string/String.ts'

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
    transform: ({ acc }) => acc
  })

  assertEquals(entry.id, 'test-operation')
  assertEquals(entry.type, 'operation')
})

Deno.test('toGqlOperationEntry - includes provided transform function', () => {
  const transformFn = ({ acc }: { acc: number | undefined }) => (acc ?? 0) + 1
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: transformFn
  })

  assertEquals(entry.transform, transformFn)
  const mockOperation = createMockGqlOperation()
  const result = entry.transform({
    context: {} as GenerateContextType,
    operation: mockOperation,
    acc: 5
  })
  assertEquals(result, 6)
})

Deno.test('toGqlOperationEntry - isSupported defaults to true when not provided', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: ({ acc }) => acc
  })

  const mockOperation = createMockGqlOperation()

  const result = entry.isSupported({
    context: { settings: {} } as GenerateContextType,
    operation: mockOperation
  })

  assertEquals(result, true)
})

Deno.test('toGqlOperationEntry - toPreviewModule is undefined when not provided', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: ({ acc }) => acc
  })

  assertEquals(entry.toPreviewModule, undefined)
})

Deno.test('toGqlOperationEntry - toMappingModule is undefined when not provided', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: ({ acc }) => acc
  })

  assertEquals(entry.toMappingModule, undefined)
})

Deno.test('toGqlOperationEntry - toEnrichmentSchema is undefined when not provided', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: ({ acc }) => acc
  })

  assertEquals(entry.toEnrichmentSchema, undefined)
})

Deno.test('toGqlOperationEntry - toEnrichmentRequest is undefined when not provided', () => {
  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: ({ acc }) => acc
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
    transform: ({ acc }) => acc,
    toPreviewModule: previewFn
  })

  assertEquals(entry.toPreviewModule, previewFn)
})

Deno.test('toGqlOperationEntry - includes toMappingModule when provided', () => {
  const mappingFn = () => ({
    name: 'mapping',
    exportPath: './mapping.ts',
    itemType: 'input' as const,
    schema: {} as any,
    group: 'forms' as const,
    items: []
  })

  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: ({ acc }) => acc,
    toMappingModule: mappingFn
  })

  assertEquals(entry.toMappingModule, mappingFn)
})

Deno.test('toGqlOperationEntry - includes all optional functions when provided', () => {
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
  const isSupportedFn = () => true
  const enrichmentRequestFn = () => undefined

  const entry = toGqlOperationEntry({
    id: 'test-operation',
    transform: transformFn,
    toPreviewModule: previewFn,
    toMappingModule: mappingFn,
    isSupported: isSupportedFn,
    toEnrichmentRequest: enrichmentRequestFn
  })

  assertEquals(entry.id, 'test-operation')
  assertEquals(entry.type, 'operation')
  assertEquals(entry.transform, transformFn)
  assertEquals(entry.toPreviewModule, previewFn)
  assertEquals(entry.toMappingModule, mappingFn)
  assertEquals(entry.toEnrichmentRequest, enrichmentRequestFn)
})
