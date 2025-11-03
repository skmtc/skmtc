import { assertEquals } from '@std/assert/equals'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'

Deno.test('ContentSettings - creates settings with enrichments', () => {
  const identifier = Identifier.createType('User')
  const enrichments = { validateRequired: true, generateComments: false }

  const settings = new ContentSettings({
    identifier,
    exportPath: './src/models/User.ts',
    enrichments
  })

  assertEquals(settings.identifier, identifier)
  assertEquals(settings.exportPath, './src/models/User.ts')
  assertEquals(settings.enrichments, enrichments)
})

Deno.test('ContentSettings.empty - creates settings without enrichments', () => {
  const identifier = Identifier.createType('Product')

  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/models/Product.ts'
  })

  assertEquals(settings.identifier, identifier)
  assertEquals(settings.exportPath, './src/models/Product.ts')
  assertEquals(settings.enrichments, undefined)
})

Deno.test('ContentSettings - stores identifier properties', () => {
  const identifier = Identifier.createVariable('apiClient', 'ApiClient')

  const settings = new ContentSettings({
    identifier,
    exportPath: './src/api.ts',
    enrichments: { includeAuth: true }
  })

  assertEquals(settings.identifier.name, 'apiClient')
  assertEquals(settings.identifier.typeName, 'ApiClient')
  assertEquals(settings.identifier.entityType.type, 'variable')
})
