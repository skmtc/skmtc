import { assertEquals } from '@std/assert/equals'
import { toPackageJson, packageJsonSchema } from '@/lib/to-package-json.ts'
import { ConfigValidationError } from '@/lib/parse-or-explain.ts'
import { join } from '@std/path/join'
import * as v from 'valibot'

Deno.test('toPackageJson - returns undefined when package.json does not exist', async () => {
  const originalCwd = Deno.cwd()
  const tempDir = await Deno.makeTempDir()

  try {
    Deno.chdir(tempDir)
    const result = await toPackageJson()
    assertEquals(result, undefined)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toPackageJson - parses valid package.json successfully', async () => {
  const originalCwd = Deno.cwd()
  const tempDir = await Deno.makeTempDir()

  try {
    Deno.chdir(tempDir)

    const packageJson = {
      name: 'test-package',
      version: '1.0.0'
    }

    await Deno.writeTextFile(join(tempDir, 'package.json'), JSON.stringify(packageJson))

    const result = await toPackageJson()

    assertEquals(result?.name, 'test-package')
    assertEquals(result?.version, '1.0.0')
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toPackageJson - throws validation error for invalid package.json', async () => {
  const originalCwd = Deno.cwd()
  const tempDir = await Deno.makeTempDir()

  try {
    Deno.chdir(tempDir)

    const invalidPackageJson = {
      name: 123, // should be string
      version: '1.0.0'
    }

    await Deno.writeTextFile(join(tempDir, 'package.json'), JSON.stringify(invalidPackageJson))

    let error: Error | undefined
    try {
      await toPackageJson()
    } catch (e) {
      error = e as Error
    }

    assertEquals(error instanceof ConfigValidationError, true)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('packageJsonSchema - validates correct structure', () => {
  const validData = {
    name: '@skmtc/test',
    version: '2.1.0'
  }

  const result = v.parse(packageJsonSchema, validData)
  assertEquals(result.name, '@skmtc/test')
  assertEquals(result.version, '2.1.0')
})

Deno.test('packageJsonSchema - rejects missing name field', () => {
  const invalidData = {
    version: '1.0.0'
  }

  let error: Error | undefined
  try {
    v.parse(packageJsonSchema, invalidData)
  } catch (e) {
    error = e as Error
  }

  assertEquals(error instanceof v.ValiError, true)
})

Deno.test('packageJsonSchema - rejects missing version field', () => {
  const invalidData = {
    name: 'test-package'
  }

  let error: Error | undefined
  try {
    v.parse(packageJsonSchema, invalidData)
  } catch (e) {
    error = e as Error
  }

  assertEquals(error instanceof v.ValiError, true)
})
