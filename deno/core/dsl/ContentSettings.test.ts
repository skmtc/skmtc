import { assertEquals } from '@std/assert/equals'
import { createType, createVariable } from '@skmtc/lang-typescript'
import { ContentSettings } from '@/dsl/ContentSettings.ts'

Deno.test('ContentSettings - creates settings with enrichments', () => {
  const identifier = createType('User')
  const enrichments = { validateRequired: true, generateComments: false }

  const settings = new ContentSettings({
    identifier,
    exportPath: './src/models/User.ts',
    enrichments,
    variant: 'main'
  })

  assertEquals(settings.identifier, identifier)
  assertEquals(settings.exportPath, './src/models/User.ts')
  assertEquals(settings.enrichments, enrichments)
})

Deno.test('ContentSettings.empty - creates settings without enrichments', () => {
  const identifier = createType('Product')

  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/models/Product.ts'
  })

  assertEquals(settings.identifier, identifier)
  assertEquals(settings.exportPath, './src/models/Product.ts')
  assertEquals(settings.enrichments, undefined)
})

Deno.test('ContentSettings - stores identifier properties', () => {
  const identifier = createVariable('apiClient', { typeName: 'ApiClient' })

  const settings = new ContentSettings({
    identifier,
    exportPath: './src/api.ts',
    enrichments: { includeAuth: true },
    variant: 'main'
  })

  assertEquals(settings.identifier.name, 'apiClient')
  assertEquals(settings.identifier.typeName, 'ApiClient')
  assertEquals(settings.identifier.kind, 'variable')
})
