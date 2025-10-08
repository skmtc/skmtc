import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { OpenApiSchema } from '@/lib/openapi-schema.ts'
import { join } from '@std/path/join'

Deno.test('OpenApiSchema - create returns instance with path and contents', () => {
  const path = '/test/openapi.yaml'
  const contents = 'openapi: 3.0.0'

  const schema = OpenApiSchema.create({ path, contents })

  assertEquals(schema.path, path)
  assertEquals(schema.contents, contents)
})

Deno.test('OpenApiSchema - exists returns false for non-existent file', async () => {
  const exists = await OpenApiSchema.exists('/non/existent/openapi.yaml')

  assertEquals(exists, false)
})

Deno.test('OpenApiSchema - exists returns true for existing file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'openapi.json')
    await Deno.writeTextFile(filePath, '{"openapi": "3.0.0"}')

    const exists = await OpenApiSchema.exists(filePath)

    assertEquals(exists, true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OpenApiSchema - exists returns false for directory', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const exists = await OpenApiSchema.exists(tempDir)

    assertEquals(exists, false)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OpenApiSchema - open throws error when file does not exist', async () => {
  await assertRejects(
    async () => {
      await OpenApiSchema.open('/non/existent/openapi.yaml')
    },
    Error,
    'OpenAPI schema not found'
  )
})

Deno.test('OpenApiSchema - open reads file contents successfully', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'openapi.json')
    const contents = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' }
    })
    await Deno.writeTextFile(filePath, contents)

    const schema = await OpenApiSchema.open(filePath)

    assertEquals(schema.path, filePath)
    assertEquals(schema.contents, contents)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OpenApiSchema - write creates file with contents', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'new-schema.yaml')
    const contents = 'openapi: 3.0.0\ninfo:\n  title: New API\n  version: 1.0.0'

    const schema = OpenApiSchema.create({ path: filePath, contents })
    await schema.write()

    const writtenContents = await Deno.readTextFile(filePath)

    assertEquals(writtenContents, contents)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OpenApiSchema - write overwrites existing file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.json')
    const originalContents = '{"openapi": "3.0.0"}'
    const newContents = '{"openapi": "3.1.0"}'

    await Deno.writeTextFile(filePath, originalContents)

    const schema = OpenApiSchema.create({ path: filePath, contents: newContents })
    await schema.write()

    const writtenContents = await Deno.readTextFile(filePath)

    assertEquals(writtenContents, newContents)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OpenApiSchema - handles YAML content', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'openapi.yaml')
    const yamlContents = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Get users`

    await Deno.writeTextFile(filePath, yamlContents)

    const schema = await OpenApiSchema.open(filePath)

    assertEquals(schema.contents, yamlContents)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OpenApiSchema - handles JSON content', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'openapi.json')
    const jsonContents = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: { summary: 'Get users' }
        }
      }
    }, null, 2)

    await Deno.writeTextFile(filePath, jsonContents)

    const schema = await OpenApiSchema.open(filePath)

    assertEquals(schema.contents, jsonContents)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OpenApiSchema - preserves exact file content', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.yaml')
    const contents = 'openapi: 3.0.0\n# Comment\ninfo:\n  title: API\n  version: 1.0.0\n'

    const schema1 = OpenApiSchema.create({ path: filePath, contents })
    await schema1.write()

    const schema2 = await OpenApiSchema.open(filePath)

    assertEquals(schema2.contents, contents)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OpenApiSchema - handles empty file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'empty.yaml')
    await Deno.writeTextFile(filePath, '')

    const schema = await OpenApiSchema.open(filePath)

    assertEquals(schema.contents, '')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
