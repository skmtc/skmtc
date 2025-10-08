import { assertEquals } from '@std/assert/equals'
import { PrettierJson } from '@/lib/prettier-json.ts'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'

Deno.test('PrettierJson - create returns instance with default settings', () => {
  const path = '/test/path/.prettierrc.json'
  const contents = {
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    bracketSpacing: true
  }
  const prettierJson = PrettierJson.create({ path, contents })

  assertEquals(prettierJson.contents.tabWidth, 2)
  assertEquals(prettierJson.contents.useTabs, false)
  assertEquals(prettierJson.contents.semi, false)
  assertEquals(prettierJson.contents.singleQuote, true)
  assertEquals(prettierJson.contents.bracketSpacing, true)
})

Deno.test('PrettierJson - toPath returns correct path', () => {
  const path = PrettierJson.toPath('test-project')

  assertEquals(path.includes('test-project'), true)
  assertEquals(path.endsWith('.prettierrc.json'), true)
})

Deno.test('PrettierJson - exists returns false for non-existent file', async () => {
  const exists = await PrettierJson.exists('/non-existent/.prettierrc.json')

  assertEquals(exists, false)
})

Deno.test('PrettierJson - write and openFromPath cycle works', async () => {
  const tempDir = await Deno.makeTempDir()
  const prettierPath = join(tempDir, '.prettierrc.json')

  try {
    await ensureDir(tempDir)

    const contents = {
      tabWidth: 2,
      useTabs: false,
      semi: false,
      singleQuote: true,
      bracketSpacing: true
    }
    const prettierJson = PrettierJson.create({ path: prettierPath, contents })
    await prettierJson.write()

    const loaded = await PrettierJson.openFromPath(prettierPath)

    assertEquals(loaded !== null, true)
    assertEquals(loaded?.contents.tabWidth, 2)
    assertEquals(loaded?.contents.singleQuote, true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('PrettierJson - openFromPath returns null when file does not exist', async () => {
  const loaded = await PrettierJson.openFromPath('/non-existent/.prettierrc.json')

  assertEquals(loaded, null)
})
