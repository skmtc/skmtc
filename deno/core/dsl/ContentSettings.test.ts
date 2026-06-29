import { assertEquals } from '@std/assert/equals'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'

Deno.test('ContentSettings - creates settings with enrichments', () => {
  const identifier = new IdentifierBase({ name: 'User' })
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
  const identifier = new IdentifierBase({ name: 'Product' })

  const settings = ContentSettings.empty({
    identifier,
    exportPath: './src/models/Product.ts'
  })

  assertEquals(settings.identifier, identifier)
  assertEquals(settings.exportPath, './src/models/Product.ts')
  assertEquals(settings.enrichments, undefined)
})

Deno.test('ContentSettings - stores identifier properties', () => {
  const identifier = new IdentifierBase({ name: 'apiClient', typeName: 'ApiClient' })

  const settings = new ContentSettings({
    identifier,
    exportPath: './src/api.ts',
    enrichments: { includeAuth: true },
    variant: 'main'
  })

  // Only the neutral identifier facts belong in a core test; the typed `type`
  // is a lang concern, exercised in each `@skmtc/lang-*` package's own tests.
  assertEquals(settings.identifier.name, 'apiClient')
  assertEquals(settings.identifier.typeName, 'ApiClient')
})
