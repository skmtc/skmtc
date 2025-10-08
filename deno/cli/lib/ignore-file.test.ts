import { assertEquals } from '@std/assert/equals'
import { assertExists } from '@std/assert/exists'
import { IgnoreFile } from '@/lib/ignore-file.ts'
import { join } from '@std/path/join'
import { EOL } from '@std/fs/eol'

Deno.test('IgnoreFile - fromFile reads and parses ignore file', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()

  try {
    Deno.chdir(tempDir)

    const ignoreContent = ['*.log', 'temp/', '!important.log'].join(EOL)
    const ignorePath = join(tempDir, '.apifoundryignore')

    await Deno.writeTextFile(ignorePath, ignoreContent)

    const ignoreFile = await IgnoreFile.fromFile('.')

    assertExists(ignoreFile)
    assertExists(ignoreFile.ignore)

    // Test default ignores
    assertEquals(ignoreFile.ignore.ignores('node_modules'), true)
    assertEquals(ignoreFile.ignore.ignores('.git'), true)
    assertEquals(ignoreFile.ignore.ignores('.yarn'), true)
    assertEquals(ignoreFile.ignore.ignores('.DS_Store'), true)
    assertEquals(ignoreFile.ignore.ignores('.apifoundry'), true)

    // Test custom ignores
    assertEquals(ignoreFile.ignore.ignores('test.log'), true)
    assertEquals(ignoreFile.ignore.ignores('temp/file.txt'), true)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('IgnoreFile - applies default ignore patterns', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()

  try {
    Deno.chdir(tempDir)

    const ignoreContent = ''
    const ignorePath = join(tempDir, '.apifoundryignore')

    await Deno.writeTextFile(ignorePath, ignoreContent)

    const ignoreFile = await IgnoreFile.fromFile('.')

    // All default patterns should be ignored
    assertEquals(ignoreFile.ignore.ignores('node_modules/package.json'), true)
    assertEquals(ignoreFile.ignore.ignores('.git/config'), true)
    assertEquals(ignoreFile.ignore.ignores('.yarn/cache'), true)
    assertEquals(ignoreFile.ignore.ignores('.DS_Store'), true)
    assertEquals(ignoreFile.ignore.ignores('.apifoundry/data'), true)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('IgnoreFile - handles multiple custom patterns', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()

  try {
    Deno.chdir(tempDir)

    const ignoreContent = ['build/', 'dist/', '*.test.ts', 'coverage/'].join(EOL)
    const ignorePath = join(tempDir, '.apifoundryignore')

    await Deno.writeTextFile(ignorePath, ignoreContent)

    const ignoreFile = await IgnoreFile.fromFile('.')

    assertEquals(ignoreFile.ignore.ignores('build/index.js'), true)
    assertEquals(ignoreFile.ignore.ignores('dist/bundle.js'), true)
    assertEquals(ignoreFile.ignore.ignores('lib/test.test.ts'), true)
    assertEquals(ignoreFile.ignore.ignores('coverage/lcov.info'), true)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('IgnoreFile - does not ignore non-matching paths', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()

  try {
    Deno.chdir(tempDir)

    const ignoreContent = ['*.log', 'temp/'].join(EOL)
    const ignorePath = join(tempDir, '.apifoundryignore')

    await Deno.writeTextFile(ignorePath, ignoreContent)

    const ignoreFile = await IgnoreFile.fromFile('.')

    assertEquals(ignoreFile.ignore.ignores('src/index.ts'), false)
    assertEquals(ignoreFile.ignore.ignores('README.md'), false)
    assertEquals(ignoreFile.ignore.ignores('package.json'), false)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('IgnoreFile - handles negation patterns correctly', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()

  try {
    Deno.chdir(tempDir)

    const ignoreContent = ['*.log', '!important.log'].join(EOL)
    const ignorePath = join(tempDir, '.apifoundryignore')

    await Deno.writeTextFile(ignorePath, ignoreContent)

    const ignoreFile = await IgnoreFile.fromFile('.')

    assertEquals(ignoreFile.ignore.ignores('test.log'), true)
    assertEquals(ignoreFile.ignore.ignores('important.log'), false)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('IgnoreFile - handles subdirectory paths correctly', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()

  try {
    Deno.chdir(tempDir)

    const subPath = 'projects/my-app'
    await Deno.mkdir(join(tempDir, subPath), { recursive: true })

    const ignoreContent = ['*.log'].join(EOL)
    const ignorePath = join(tempDir, subPath, '.apifoundryignore')

    await Deno.writeTextFile(ignorePath, ignoreContent)

    const ignoreFile = await IgnoreFile.fromFile(subPath)

    assertEquals(ignoreFile.ignore.ignores('error.log'), true)
    assertEquals(ignoreFile.ignore.ignores('src/index.ts'), false)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('IgnoreFile - handles empty lines in ignore file', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()

  try {
    Deno.chdir(tempDir)

    const ignoreContent = ['*.log', '', 'temp/', '', '*.tmp'].join(EOL)
    const ignorePath = join(tempDir, '.apifoundryignore')

    await Deno.writeTextFile(ignorePath, ignoreContent)

    const ignoreFile = await IgnoreFile.fromFile('.')

    assertEquals(ignoreFile.ignore.ignores('test.log'), true)
    assertEquals(ignoreFile.ignore.ignores('temp/file.txt'), true)
    assertEquals(ignoreFile.ignore.ignores('cache.tmp'), true)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})
