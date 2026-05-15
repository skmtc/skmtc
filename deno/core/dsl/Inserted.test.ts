import { assertEquals } from '@std/assert/equals'
import { Inserted } from '@/dsl/Inserted.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { Definition } from '@/dsl/Definition.ts'
import { toGeneratorOnlyKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '../context/generateTypes.ts'

// Minimal mock context for testing
const mockContext = {} as GenerateContextType
const testGeneratorKey = toGeneratorOnlyKey({ generatorId: 'test' })

Deno.test('Inserted - toName returns identifier name', () => {
  const identifier = Identifier.createType('User')
  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/models/User.ts'
  })

  const definition = new Definition({
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
  const identifier = Identifier.createVariable('apiClient', 'ApiClient')
  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/api.ts'
  })

  const definition = new Definition({
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
  assertEquals(resultIdentifier.entityType.type, 'variable')
})

Deno.test('Inserted - toExportPath returns export path', () => {
  const identifier = Identifier.createType('Product')
  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/models/Product.ts'
  })

  const definition = new Definition({
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
  const identifier = Identifier.createType('Status')
  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/types.ts'
  })

  const value = { generatorKey: testGeneratorKey, toString: () => "'active' | 'inactive'" }
  const definition = new Definition({
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
  const identifier = Identifier.createType('ValidatedUser')
  const enrichments = { validateRequired: true, generateComments: false }
  const settings = new ContentSettings({
    identifier,
    exportPath: './src/validated.ts',
    enrichments,
    variant: 'main'
  })

  const definition = new Definition({
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
