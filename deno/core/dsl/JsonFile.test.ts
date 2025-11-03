import { assertEquals } from '@std/assert/equals'
import { JsonFile } from '@/dsl/JsonFile.ts'

Deno.test('JsonFile - creates file with path and content', () => {
  const file = new JsonFile({
    path: './config.json',
    content: { name: 'test', value: 42 }
  })

  assertEquals(file.path, './config.json')
  assertEquals(file.fileType, 'json')
  assertEquals(file.content, { name: 'test', value: 42 })
})

Deno.test('JsonFile - toString formats JSON with 2-space indentation', () => {
  const file = new JsonFile({
    path: './data.json',
    content: { name: 'test', value: 42 }
  })

  assertEquals(file.toString(), '{\n  "name": "test",\n  "value": 42\n}')
})

Deno.test('JsonFile - handles nested objects', () => {
  const file = new JsonFile({
    path: './package.json',
    content: {
      name: 'my-package',
      version: '1.0.0',
      dependencies: {
        axios: '^1.0.0',
        lodash: '^4.17.21'
      }
    }
  })

  const expected = `{
  "name": "my-package",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.0.0",
    "lodash": "^4.17.21"
  }
}`

  assertEquals(file.toString(), expected)
})

Deno.test('JsonFile - handles arrays', () => {
  const file = new JsonFile({
    path: './list.json',
    content: {
      items: ['item1', 'item2', 'item3'],
      count: 3
    }
  })

  const expected = `{
  "items": [
    "item1",
    "item2",
    "item3"
  ],
  "count": 3
}`

  assertEquals(file.toString(), expected)
})

Deno.test('JsonFile - handles empty object', () => {
  const file = new JsonFile({
    path: './empty.json',
    content: {}
  })

  assertEquals(file.toString(), '{}')
})
