import { assertEquals } from '@std/assert/equals'
import { Definition } from '@/dsl/Definition.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { toGeneratorOnlyKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContext } from '@/context/GenerateContext.ts'

// Minimal mock context for testing
const mockContext = {} as GenerateContext
const testGeneratorKey = toGeneratorOnlyKey({ generatorId: 'test' })

Deno.test('Definition - creates type definition with export', () => {
  const definition = new Definition({
    context: mockContext,
    identifier: Identifier.createType('User'),
    value: {
      generatorKey: testGeneratorKey,
      toString: () => '{ id: string; name: string; }'
    }
  })

  assertEquals(
    definition.toString(),
    'export type User = { id: string; name: string; };\n'
  )
})

Deno.test('Definition - creates const definition with type annotation', () => {
  const definition = new Definition({
    context: mockContext,
    identifier: Identifier.createVariable('API_URL', 'string'),
    value: {
      generatorKey: testGeneratorKey,
      toString: () => '"https://api.example.com"'
    }
  })

  assertEquals(
    definition.toString(),
    'export const API_URL: string = "https://api.example.com";\n'
  )
})

Deno.test('Definition - creates definition without type annotation', () => {
  const definition = new Definition({
    context: mockContext,
    identifier: Identifier.createVariable('count'),
    value: {
      generatorKey: testGeneratorKey,
      toString: () => '42'
    }
  })

  assertEquals(definition.toString(), 'export const count = 42;\n')
})

Deno.test('Definition - creates definition with JSDoc description', () => {
  const definition = new Definition({
    context: mockContext,
    identifier: Identifier.createType('Status'),
    description: 'Possible status values',
    value: {
      generatorKey: testGeneratorKey,
      toString: () => "'pending' | 'complete' | 'failed'"
    }
  })

  assertEquals(
    definition.toString(),
    '/** Possible status values */\nexport type Status = \'pending\' | \'complete\' | \'failed\';\n'
  )
})

Deno.test('Definition - creates non-exported definition with noExport flag', () => {
  const definition = new Definition({
    context: mockContext,
    identifier: Identifier.createVariable('helper'),
    value: {
      generatorKey: testGeneratorKey,
      toString: () => '() => true'
    },
    noExport: true
  })

  assertEquals(definition.toString(), 'const helper = () => true;\n')
})

Deno.test('Definition - preserves identifier properties', () => {
  const identifier = Identifier.createVariable('userId', 'string')
  const definition = new Definition({
    context: mockContext,
    identifier,
    value: {
      generatorKey: testGeneratorKey,
      toString: () => '"user123"'
    }
  })

  assertEquals(definition.identifier, identifier)
  assertEquals(definition.identifier.name, 'userId')
  assertEquals(definition.identifier.typeName, 'string')
})
