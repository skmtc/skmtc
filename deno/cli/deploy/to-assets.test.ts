import { assertEquals } from '@std/assert/equals'
import { toAssets } from '@/deploy/to-assets.ts'
import { join } from '@std/path/join'

Deno.test('toAssets - converts files to DenoFile objects', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    // Create test files
    await Deno.writeTextFile(join(tempDir, 'test.ts'), 'export const foo = "bar"')
    await Deno.writeTextFile(join(tempDir, 'README.md'), '# Test Project')

    const result = await toAssets({ projectRoot: tempDir })

    assertEquals(result['test.ts'].kind, 'file')
    assertEquals(result['test.ts'].encoding, 'utf-8')
    assertEquals(result['test.ts'].content, 'export const foo = "bar"')

    assertEquals(result['README.md'].kind, 'file')
    assertEquals(result['README.md'].encoding, 'utf-8')
    assertEquals(result['README.md'].content, '# Test Project')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - generates relative paths from projectRoot', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    // Create nested directory structure
    await Deno.mkdir(join(tempDir, 'src'), { recursive: true })
    await Deno.writeTextFile(join(tempDir, 'src', 'index.ts'), 'export const main = () => {}')

    const result = await toAssets({ projectRoot: tempDir })

    assertEquals(result['src/index.ts'].kind, 'file')
    assertEquals(result['src/index.ts'].content, 'export const main = () => {}')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - skips directories', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    await Deno.mkdir(join(tempDir, 'src'), { recursive: true })
    await Deno.writeTextFile(join(tempDir, 'file.ts'), 'content')

    const result = await toAssets({ projectRoot: tempDir })

    // Should only have the file, not the directory
    assertEquals(Object.keys(result), ['file.ts'])
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - skips .DS_Store files', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    await Deno.writeTextFile(join(tempDir, '.DS_Store'), 'system file')
    await Deno.writeTextFile(join(tempDir, 'index.ts'), 'export {}')

    const result = await toAssets({ projectRoot: tempDir })

    assertEquals(Object.keys(result), ['index.ts'])
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - skips .logs directory files', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    await Deno.mkdir(join(tempDir, '.logs'), { recursive: true })
    await Deno.writeTextFile(join(tempDir, '.logs', 'app.log'), 'log content')
    await Deno.writeTextFile(join(tempDir, 'app.ts'), 'export {}')

    const result = await toAssets({ projectRoot: tempDir })

    assertEquals(Object.keys(result), ['app.ts'])
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - skips openapi.json and openapi.yaml files', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    await Deno.writeTextFile(join(tempDir, 'openapi.json'), '{}')
    await Deno.writeTextFile(join(tempDir, 'openapi.yaml'), 'openapi: 3.0.0')
    await Deno.writeTextFile(join(tempDir, 'index.ts'), 'export {}')

    const result = await toAssets({ projectRoot: tempDir })

    assertEquals(Object.keys(result), ['index.ts'])
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - skips .settings directory files', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    await Deno.mkdir(join(tempDir, '.settings'), { recursive: true })
    await Deno.writeTextFile(join(tempDir, '.settings', 'files.json'), '{}')
    await Deno.writeTextFile(join(tempDir, '.settings', 'manifest.json'), '{}')
    await Deno.writeTextFile(join(tempDir, '.settings', 'client.json'), '{}')
    await Deno.writeTextFile(join(tempDir, 'config.ts'), 'export {}')

    const result = await toAssets({ projectRoot: tempDir })

    assertEquals(Object.keys(result), ['config.ts'])
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - handles empty directory', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const result = await toAssets({ projectRoot: tempDir })

    assertEquals(result, {})
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - handles nested directory structure', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    await Deno.mkdir(join(tempDir, 'src', 'components'), { recursive: true })
    await Deno.mkdir(join(tempDir, 'src', 'utils'), { recursive: true })

    await Deno.writeTextFile(join(tempDir, 'src', 'index.ts'), 'export * from "./components"')
    await Deno.writeTextFile(join(tempDir, 'src', 'components', 'Button.tsx'), 'export const Button = () => {}')
    await Deno.writeTextFile(join(tempDir, 'src', 'utils', 'helpers.ts'), 'export const helper = () => {}')

    const result = await toAssets({ projectRoot: tempDir })

    assertEquals(Object.keys(result).sort(), [
      'src/components/Button.tsx',
      'src/index.ts',
      'src/utils/helpers.ts'
    ])
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toAssets - all files have utf-8 encoding', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    await Deno.writeTextFile(join(tempDir, 'file1.ts'), 'content1')
    await Deno.writeTextFile(join(tempDir, 'file2.md'), 'content2')

    const result = await toAssets({ projectRoot: tempDir })

    for (const file of Object.values(result)) {
      assertEquals(file.encoding, 'utf-8')
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
