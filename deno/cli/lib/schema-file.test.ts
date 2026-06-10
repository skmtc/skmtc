import { assertEquals, assertRejects } from '@std/assert'
import { SchemaFile, toSchemaSource } from '@/lib/schema-file.ts'
import { join } from '@std/path/join'

Deno.test('toSchemaSource - identifies HTTP URLs as remote', () => {
  const source = toSchemaSource('http://example.com/schema.json')

  assertEquals(source.type, 'remote')
  if (source.type === 'remote') {
    assertEquals(source.url, 'http://example.com/schema.json')
  }
})

Deno.test('toSchemaSource - identifies HTTPS URLs as remote', () => {
  const source = toSchemaSource('https://example.com/openapi.yaml')

  assertEquals(source.type, 'remote')
  if (source.type === 'remote') {
    assertEquals(source.url, 'https://example.com/openapi.yaml')
  }
})

Deno.test('toSchemaSource - identifies local paths', () => {
  const source = toSchemaSource('./schema.json')

  assertEquals(source.type, 'local')
  if (source.type === 'local') {
    assertEquals(source.path, './schema.json')
  }
})

Deno.test('toSchemaSource - handles absolute local paths', () => {
  const source = toSchemaSource('/absolute/path/to/schema.yaml')

  assertEquals(source.type, 'local')
  if (source.type === 'local') {
    assertEquals(source.path, '/absolute/path/to/schema.yaml')
  }
})

Deno.test('toSchemaSource - handles relative paths with parent references', () => {
  const source = toSchemaSource('../schemas/openapi.json')

  assertEquals(source.type, 'local')
  if (source.type === 'local') {
    assertEquals(source.path, '../schemas/openapi.json')
  }
})

// Tests for SchemaFile class
Deno.test('SchemaFile.create - returns instance with null values', () => {
  const schemaFile = SchemaFile.create()

  assertEquals(schemaFile.contents, null)
  assertEquals(schemaFile.schemaSource, null)
  assertEquals(schemaFile.fileType, null)
})

Deno.test('SchemaFile.openFromSource - opens local JSON file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.json')
    const contents = JSON.stringify({ openapi: '3.0.0' })
    await Deno.writeTextFile(filePath, contents)

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.contents, contents)
    assertEquals(schemaFile.fileType, 'json')
    assertEquals(schemaFile.schemaSource?.type, 'local')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.openFromSource - opens local YAML file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.yaml')
    const contents = 'openapi: 3.0.0'
    await Deno.writeTextFile(filePath, contents)

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.contents, contents)
    assertEquals(schemaFile.fileType, 'yaml')
    assertEquals(schemaFile.schemaSource?.type, 'local')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.openFromSource - handles .yml extension', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.yml')
    const contents = 'openapi: 3.0.0'
    await Deno.writeTextFile(filePath, contents)

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.fileType, 'yaml')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.getFromSource - rejects unsupported file extension', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.txt')
    await Deno.writeTextFile(filePath, 'test content')

    const source = { type: 'local' as const, path: filePath }

    await assertRejects(
      async () => {
        await SchemaFile.getFromSource(source)
      },
      Error,
      'Schema file extension not recognized'
    )
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.getFromSource - handles local JSON correctly', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'test.json')
    const jsonContent = '{"test": "data"}'
    await Deno.writeTextFile(filePath, jsonContent)

    const source = { type: 'local' as const, path: filePath }
    const result = await SchemaFile.getFromSource(source)

    assertEquals(result.contents, jsonContent)
    assertEquals(result.fileType, 'json')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.getFromSource - handles local YAML correctly', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'test.yaml')
    const yamlContent = 'test: data'
    await Deno.writeTextFile(filePath, yamlContent)

    const source = { type: 'local' as const, path: filePath }
    const result = await SchemaFile.getFromSource(source)

    assertEquals(result.contents, yamlContent)
    assertEquals(result.fileType, 'yaml')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.openFromSource - returns consistent schemaSource', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.json')
    await Deno.writeTextFile(filePath, '{}')

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.schemaSource?.type, 'local')
    if (schemaFile.schemaSource?.type === 'local') {
      // Should be the absolute resolved path
      assertEquals(schemaFile.schemaSource.path.includes(filePath), true)
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
