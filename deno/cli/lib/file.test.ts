import { assertEquals } from '@std/assert/equals'
import { assertExists } from '@std/assert/exists'
import { readTextFile, writeFileSafeDir } from '@/lib/file.ts'
import { join } from '@std/path/join'

Deno.test('readTextFile - returns file contents when file exists', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'test.txt')
    const expectedContent = 'Hello, World!'

    await Deno.writeTextFile(filePath, expectedContent)

    const result = await readTextFile(filePath)

    assertEquals(result, expectedContent)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('readTextFile - returns undefined when file does not exist', async () => {
  const result = await readTextFile('/non/existent/path/file.txt')

  assertEquals(result, undefined)
})

Deno.test('readTextFile - handles empty files correctly', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'empty.txt')

    await Deno.writeTextFile(filePath, '')

    const result = await readTextFile(filePath)

    assertEquals(result, '')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('readTextFile - handles files with special characters', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'special.txt')
    const content = 'Special chars: 😀 ñ © \n\t\r'

    await Deno.writeTextFile(filePath, content)

    const result = await readTextFile(filePath)

    assertEquals(result, content)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeFileSafeDir - creates file when directory exists', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'test.txt')
    const content = 'Test content'

    await writeFileSafeDir(filePath, content)

    const writtenContent = await Deno.readTextFile(filePath)

    assertEquals(writtenContent, content)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeFileSafeDir - creates nested directories when they do not exist', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const nestedPath = join(tempDir, 'level1', 'level2', 'level3', 'file.txt')
    const content = 'Nested file content'

    await writeFileSafeDir(nestedPath, content)

    const writtenContent = await Deno.readTextFile(nestedPath)

    assertEquals(writtenContent, content)

    const dirExists = await Deno.stat(join(tempDir, 'level1', 'level2', 'level3'))
    assertExists(dirExists)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeFileSafeDir - overwrites existing file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'overwrite.txt')
    const originalContent = 'Original'
    const newContent = 'Updated'

    await Deno.writeTextFile(filePath, originalContent)

    await writeFileSafeDir(filePath, newContent)

    const writtenContent = await Deno.readTextFile(filePath)

    assertEquals(writtenContent, newContent)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeFileSafeDir - handles empty content', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'empty.txt')
    const content = ''

    await writeFileSafeDir(filePath, content)

    const writtenContent = await Deno.readTextFile(filePath)

    assertEquals(writtenContent, content)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeFileSafeDir - handles JSON content', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'data.json')
    const jsonData = { name: 'test', version: '1.0.0' }
    const content = JSON.stringify(jsonData, null, 2)

    await writeFileSafeDir(filePath, content)

    const writtenContent = await Deno.readTextFile(filePath)
    const parsedData = JSON.parse(writtenContent)

    assertEquals(parsedData.name, 'test')
    assertEquals(parsedData.version, '1.0.0')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
