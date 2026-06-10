import { assertEquals } from '@std/assert'
import { fileTypeToProtocol } from './types.ts'

Deno.test('fileTypeToProtocol - json maps to oas', () => {
  assertEquals(fileTypeToProtocol('json'), 'oas')
})

Deno.test('fileTypeToProtocol - yaml maps to oas', () => {
  assertEquals(fileTypeToProtocol('yaml'), 'oas')
})

Deno.test('fileTypeToProtocol - graphql maps to gql', () => {
  assertEquals(fileTypeToProtocol('graphql'), 'gql')
})
