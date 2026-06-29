import { assertEquals } from '@std/assert/equals'
import { Inserted } from '@/dsl/Inserted.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition } from '@/test/MockFile.ts'
import { toGeneratorOnlyKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

// Minimal mock context for testing
const mockContext = {} as GenerateContextType
const testGeneratorKey = toGeneratorOnlyKey({ generatorId: 'test' })

Deno.test('Inserted - toName returns identifier name', () => {
  const identifier = new IdentifierBase({ name: 'User' })
  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/models/User.ts'
  })

  const definition = new MockDefinition({
    context: mockContext,
    identifier,
    value: { generatorKey: testGeneratorKey, toString: () => '{ id: string }' }
  })

  const inserted = new Inserted({
    settings,
    definition
  })

  assertEquals(inserted.toName(), 'User')
})

Deno.test('Inserted - toIdentifier returns full identifier', () => {
  const identifier = new IdentifierBase({ name: 'apiClient', typeName: 'ApiClient' })
  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/api.ts'
  })

  const definition = new MockDefinition({
    context: mockContext,
    identifier,
    value: { generatorKey: testGeneratorKey, toString: () => 'new Client()' }
  })

  const inserted = new Inserted({
    settings,
    definition
  })

  const resultIdentifier = inserted.toIdentifier()

  assertEquals(resultIdentifier.name, 'apiClient')
  assertEquals(resultIdentifier.typeName, 'ApiClient')
})

Deno.test('Inserted - toExportPath returns export path', () => {
  const identifier = new IdentifierBase({ name: 'Product' })
  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/models/Product.ts'
  })

  const definition = new MockDefinition({
    context: mockContext,
    identifier,
    value: { generatorKey: testGeneratorKey, toString: () => '{ name: string }' }
  })

  const inserted = new Inserted({
    settings,
    definition
  })

  assertEquals(inserted.toExportPath(), './src/models/Product.ts')
})

Deno.test('Inserted - toValue returns generated value', () => {
  const identifier = new IdentifierBase({ name: 'Status' })
  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/types.ts'
  })

  const value = { generatorKey: testGeneratorKey, toString: () => "'active' | 'inactive'" }
  const definition = new MockDefinition({
    context: mockContext,
    identifier,
    value
  })

  const inserted = new Inserted({
    settings,
    definition
  })

  assertEquals(inserted.toValue(), value)
})

Deno.test('Inserted - works with enrichments', () => {
  const identifier = new IdentifierBase({ name: 'ValidatedUser' })
  const enrichments = { validateRequired: true, generateComments: false }
  const settings = new ContentSettings({
    identifier,
    exportPath: './src/validated.ts',
    enrichments,
    variant: 'main'
  })

  const definition = new MockDefinition({
    context: mockContext,
    identifier,
    value: { generatorKey: testGeneratorKey, toString: () => '{ id: string }' }
  })

  const inserted = new Inserted({
    settings,
    definition
  })

  assertEquals(inserted.settings.enrichments, enrichments)
  assertEquals(inserted.toName(), 'ValidatedUser')
})
