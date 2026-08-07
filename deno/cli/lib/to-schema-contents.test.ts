import { assertEquals, assertRejects } from '@std/assert'
import { stub, type Stub } from '@std/testing/mock'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { SchemaFile } from '@/lib/schema-file.ts'
import type { SchemaSource } from '@/lib/types.ts'

Deno.test('toSchemaContents', async t => {
  await t.step('should handle remote schema sources with JSON', async () => {
    let getFromSourceStub: Stub | undefined

    try {
      const mockContents = JSON.stringify({ openapi: '3.0.0' })
      const mockSchemaSource: SchemaSource = {
        type: 'remote',
        url: 'https://api.example.com/openapi.json'
      }

      getFromSourceStub = stub(SchemaFile, 'getFromSource', () =>
        Promise.resolve({
          contents: mockContents,
          schemaSource: mockSchemaSource
        })
      )

      const result = await toSchemaContents('https://api.example.com/openapi.json')

      assertEquals(result.contents, mockContents)
      assertEquals(result.schemaSource, mockSchemaSource)
    } finally {
      getFromSourceStub?.restore()
    }
  })

  await t.step('should handle remote schema sources with YAML', async () => {
    let getFromSourceStub: Stub | undefined

    try {
      const mockContents = 'openapi: 3.0.0\n'
      const mockSchemaSource: SchemaSource = {
        type: 'remote',
        url: 'https://api.example.com/openapi.yaml'
      }

      getFromSourceStub = stub(SchemaFile, 'getFromSource', () =>
        Promise.resolve({
          contents: mockContents,
          schemaSource: mockSchemaSource
        })
      )

      const result = await toSchemaContents('https://api.example.com/openapi.yaml')

      assertEquals(result.contents, mockContents)
      assertEquals(result.schemaSource, mockSchemaSource)
    } finally {
      getFromSourceStub?.restore()
    }
  })

  await t.step('should preserve absolute paths for local schemas', async () => {
    let getFromSourceStub: Stub | undefined

    try {
      const absolutePath = '/absolute/path/to/openapi.json'
      const mockContents = JSON.stringify({ openapi: '3.0.0' })
      const mockSchemaSource: SchemaSource = {
        type: 'local',
        path: absolutePath
      }

      getFromSourceStub = stub(SchemaFile, 'getFromSource', () =>
        Promise.resolve({
          contents: mockContents,
          schemaSource: mockSchemaSource
        })
      )

      const result = await toSchemaContents(absolutePath)

      assertEquals(result.contents, mockContents)
      assertEquals(result.schemaSource.type, 'local')
      if (result.schemaSource.type === 'local') {
        assertEquals(result.schemaSource.path, absolutePath)
      }
    } finally {
      getFromSourceStub?.restore()
    }
  })

  await t.step('should convert relative paths to absolute for local schemas', async () => {
    let getFromSourceStub: Stub | undefined

    try {
      const relativePath = 'schemas/openapi.json'
      const mockContents = JSON.stringify({ openapi: '3.0.0' })

      // Mock will receive the converted absolute path
      getFromSourceStub = stub(SchemaFile, 'getFromSource', (schemaSource: SchemaSource) => {
        // Verify that the path was converted to absolute
        if (schemaSource.type === 'local') {
          // Path should now be absolute (starts with /)
          assertEquals(schemaSource.path.startsWith('/'), true)
          assertEquals(schemaSource.path.includes(relativePath), true)
        }

        return Promise.resolve({
          contents: mockContents,
          schemaSource
        })
      })

      const result = await toSchemaContents(relativePath)

      assertEquals(result.contents, mockContents)
      assertEquals(result.schemaSource.type, 'local')
      if (result.schemaSource.type === 'local') {
        // Verify path is now absolute
        assertEquals(result.schemaSource.path.startsWith('/'), true)
        assertEquals(result.schemaSource.path.includes(relativePath), true)
      }
    } finally {
      getFromSourceStub?.restore()
    }
  })

  await t.step('should handle YAML files with local paths', async () => {
    let getFromSourceStub: Stub | undefined

    try {
      const absolutePath = '/absolute/path/to/openapi.yaml'
      const mockContents = 'openapi: 3.0.0\n'
      const mockSchemaSource: SchemaSource = {
        type: 'local',
        path: absolutePath
      }

      getFromSourceStub = stub(SchemaFile, 'getFromSource', () =>
        Promise.resolve({
          contents: mockContents,
          schemaSource: mockSchemaSource
        })
      )

      const result = await toSchemaContents(absolutePath)

      assertEquals(result.contents, mockContents)
    } finally {
      getFromSourceStub?.restore()
    }
  })

  await t.step('should propagate errors from SchemaFile.getFromSource', async () => {
    let getFromSourceStub: Stub | undefined

    try {
      const errorMessage = 'Failed to fetch schema'

      getFromSourceStub = stub(SchemaFile, 'getFromSource', () =>
        Promise.reject(new Error(errorMessage))
      )

      await assertRejects(
        async () => await toSchemaContents('https://api.example.com/openapi.json'),
        Error,
        errorMessage
      )
    } finally {
      getFromSourceStub?.restore()
    }
  })

  await t.step('should handle HTTP URLs (not just HTTPS)', async () => {
    let getFromSourceStub: Stub | undefined

    try {
      const mockContents = JSON.stringify({ openapi: '3.0.0' })
      const mockSchemaSource: SchemaSource = {
        type: 'remote',
        url: 'http://api.example.com/openapi.json'
      }

      getFromSourceStub = stub(SchemaFile, 'getFromSource', () =>
        Promise.resolve({
          contents: mockContents,
          schemaSource: mockSchemaSource
        })
      )

      const result = await toSchemaContents('http://api.example.com/openapi.json')

      assertEquals(result.schemaSource.type, 'remote')
      if (result.schemaSource.type === 'remote') {
        assertEquals(result.schemaSource.url, 'http://api.example.com/openapi.json')
      }
    } finally {
      getFromSourceStub?.restore()
    }
  })

  await t.step('should handle empty relative paths', async () => {
    let getFromSourceStub: Stub | undefined

    try {
      const relativePath = ''
      const mockContents = JSON.stringify({ openapi: '3.0.0' })

      getFromSourceStub = stub(SchemaFile, 'getFromSource', (schemaSource: SchemaSource) => {
        return Promise.resolve({
          contents: mockContents,
          schemaSource
        })
      })

      const result = await toSchemaContents(relativePath)

      assertEquals(result.contents, mockContents)
      assertEquals(result.schemaSource.type, 'local')
    } finally {
      getFromSourceStub?.restore()
    }
  })
})
