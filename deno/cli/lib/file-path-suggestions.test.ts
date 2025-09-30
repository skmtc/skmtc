import { assertEquals } from '@std/assert'
import {
  getFilePathSuggestions,
  getCommonPrefix,
  findSuggestionToApply,
  toRelativePath
} from '@/lib/file-path-suggestions.ts'
import { isUrl } from '@/lib/is-url.ts'
import { join } from '@std/path'

Deno.test('isUrl - detects http URLs', () => {
  assertEquals(isUrl('http://example.com/schema.json'), true)
})

Deno.test('isUrl - detects https URLs', () => {
  assertEquals(isUrl('https://example.com/schema.json'), true)
})

Deno.test('isUrl - returns false for local paths', () => {
  assertEquals(isUrl('./schema.json'), false)
  assertEquals(isUrl('/path/to/schema.json'), false)
  assertEquals(isUrl('schema.json'), false)
})

Deno.test('getFilePathSuggestions - returns empty array for URLs', async () => {
  const suggestions = await getFilePathSuggestions('http://example.com/schema.json')
  assertEquals(suggestions, [])
})

Deno.test('getFilePathSuggestions - returns empty array for https URLs', async () => {
  const suggestions = await getFilePathSuggestions('https://example.com/schema.json')
  assertEquals(suggestions, [])
})

Deno.test('getFilePathSuggestions - filters by extensions', async () => {
  // Create a temporary .skmtc structure
  const tempRoot = await Deno.makeTempDir()
  const skmtcDir = join(tempRoot, '.skmtc')
  await Deno.mkdir(skmtcDir)

  try {
    // Create test files in temp root
    await Deno.writeTextFile(join(tempRoot, 'schema.json'), '{}')
    await Deno.writeTextFile(join(tempRoot, 'schema.yaml'), '')
    await Deno.writeTextFile(join(tempRoot, 'schema.yml'), '')
    await Deno.writeTextFile(join(tempRoot, 'readme.txt'), '')
    await Deno.writeTextFile(join(tempRoot, 'readme.md'), '')

    // Change to temp root so toRootPath() finds our .skmtc
    const originalCwd = Deno.cwd()
    Deno.chdir(tempRoot)

    try {
      // Get suggestions (empty input lists root directory)
      const suggestions = await getFilePathSuggestions('', {
        extensions: ['.json', '.yaml', '.yml'],
        maxSuggestions: 10
      })

      // Should only include .json, .yaml, .yml files (and .skmtc directory)
      assertEquals(suggestions.some(s => s.includes('schema.json')), true)
      assertEquals(suggestions.some(s => s.includes('schema.yaml')), true)
      assertEquals(suggestions.some(s => s.includes('schema.yml')), true)
      assertEquals(suggestions.some(s => s.includes('readme.txt')), false)
      assertEquals(suggestions.some(s => s.includes('readme.md')), false)
    } finally {
      Deno.chdir(originalCwd)
    }
  } finally {
    // Cleanup
    await Deno.remove(tempRoot, { recursive: true })
  }
})

Deno.test('getFilePathSuggestions - includes directories with trailing slash', async () => {
  // Create a temporary .skmtc structure
  const tempRoot = await Deno.makeTempDir()
  const skmtcDir = join(tempRoot, '.skmtc')
  await Deno.mkdir(skmtcDir)

  try {
    // Create subdirectories
    await Deno.mkdir(join(tempRoot, 'schemas'))
    await Deno.mkdir(join(tempRoot, 'docs'))
    await Deno.writeTextFile(join(tempRoot, 'schema.json'), '{}')

    const originalCwd = Deno.cwd()
    Deno.chdir(tempRoot)

    try {
      // Get suggestions
      const suggestions = await getFilePathSuggestions('', {
        extensions: ['.json'],
        maxSuggestions: 10
      })

      // Should include directories with trailing slash
      assertEquals(suggestions.some(s => s.endsWith('schemas/')), true)
      assertEquals(suggestions.some(s => s.endsWith('docs/')), true)
    } finally {
      Deno.chdir(originalCwd)
    }
  } finally {
    // Cleanup
    await Deno.remove(tempRoot, { recursive: true })
  }
})

Deno.test('getFilePathSuggestions - sorts directories before files', async () => {
  // Create a temporary directory
  const tempDir = await Deno.makeTempDir()

  try {
    // Create files and directories
    await Deno.writeTextFile(join(tempDir, 'a-file.json'), '{}')
    await Deno.mkdir(join(tempDir, 'z-directory'))
    await Deno.writeTextFile(join(tempDir, 'b-file.json'), '{}')

    // Get suggestions
    const suggestions = await getFilePathSuggestions(tempDir + '/', {
      extensions: ['.json'],
      maxSuggestions: 10
    })

    // Directories should come first
    const firstSuggestion = suggestions[0]
    assertEquals(firstSuggestion.endsWith('z-directory/'), true)
  } finally {
    // Cleanup
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('getFilePathSuggestions - filters by partial name', async () => {
  // Create a temporary directory
  const tempDir = await Deno.makeTempDir()

  try {
    // Create files
    await Deno.writeTextFile(join(tempDir, 'openapi.json'), '{}')
    await Deno.writeTextFile(join(tempDir, 'swagger.json'), '{}')
    await Deno.writeTextFile(join(tempDir, 'schema.json'), '{}')

    // Get suggestions with partial name
    const suggestions = await getFilePathSuggestions(join(tempDir, 'ope'), {
      extensions: ['.json'],
      maxSuggestions: 10
    })

    // Should only include files starting with 'ope'
    assertEquals(suggestions.some(s => s.includes('openapi.json')), true)
    assertEquals(suggestions.some(s => s.includes('swagger.json')), false)
    assertEquals(suggestions.some(s => s.includes('schema.json')), false)
  } finally {
    // Cleanup
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('getFilePathSuggestions - respects maxSuggestions', async () => {
  // Create a temporary directory
  const tempDir = await Deno.makeTempDir()

  try {
    // Create many files
    for (let i = 0; i < 20; i++) {
      await Deno.writeTextFile(join(tempDir, `file${i}.json`), '{}')
    }

    // Get suggestions with limit
    const suggestions = await getFilePathSuggestions(tempDir + '/', {
      extensions: ['.json'],
      maxSuggestions: 5
    })

    // Should respect the limit
    assertEquals(suggestions.length, 5)
  } finally {
    // Cleanup
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('getFilePathSuggestions - handles non-existent directory gracefully', async () => {
  const suggestions = await getFilePathSuggestions('/non/existent/directory/', {
    extensions: ['.json'],
    maxSuggestions: 10
  })

  // Should return empty array for non-existent directories
  assertEquals(suggestions, [])
})

Deno.test('getFilePathSuggestions - returns relative paths when basePath provided', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    // Create test files in temp directory
    await Deno.writeTextFile(join(tempDir, 'schema.json'), '{}')
    await Deno.writeTextFile(join(tempDir, 'openapi.yaml'), '')
    await Deno.mkdir(join(tempDir, 'schemas'))
    await Deno.writeTextFile(join(tempDir, 'schemas', 'petstore.json'), '{}')

    // Get suggestions with basePath - using empty string to list current directory files
    const suggestions = await getFilePathSuggestions('', {
      extensions: ['.json', '.yaml'],
      maxSuggestions: 10,
      basePath: tempDir
    })

    // Since we're not in tempDir, we won't get these files
    // Let's change directory first or test differently
    const originalCwd = Deno.cwd()
    Deno.chdir(tempDir)

    try {
      const suggestionsInDir = await getFilePathSuggestions('', {
        extensions: ['.json', '.yaml'],
        maxSuggestions: 10,
        basePath: tempDir
      })

      // Should return relative paths
      assertEquals(suggestionsInDir.includes('schema.json'), true, `Expected 'schema.json' in ${JSON.stringify(suggestionsInDir)}`)
      assertEquals(suggestionsInDir.includes('openapi.yaml'), true)
      // Directory suggestions should have trailing slash preserved
      assertEquals(suggestionsInDir.includes('schemas/'), true)

      // Should NOT contain absolute paths
      assertEquals(suggestionsInDir.every(s => !s.includes(tempDir)), true)
    } finally {
      Deno.chdir(originalCwd)
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('getFilePathSuggestions - returns absolute paths when no basePath', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    // Create test file
    await Deno.writeTextFile(join(tempDir, 'schema.json'), '{}')

    const originalCwd = Deno.cwd()
    Deno.chdir(tempDir)

    try {
      // Get suggestions WITHOUT basePath - will return full paths
      const suggestions = await getFilePathSuggestions('', {
        extensions: ['.json'],
        maxSuggestions: 10
      })

      // Should contain the full path to the file
      assertEquals(suggestions.some(s => s.includes('schema.json')), true)
    } finally {
      Deno.chdir(originalCwd)
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

// Tests for getCommonPrefix
Deno.test('getCommonPrefix - returns empty string for empty array', () => {
  assertEquals(getCommonPrefix([]), '')
})

Deno.test('getCommonPrefix - returns the string for single element', () => {
  assertEquals(getCommonPrefix(['schema.json']), 'schema.json')
})

Deno.test('getCommonPrefix - finds common prefix for multiple strings', () => {
  assertEquals(getCommonPrefix(['schema.json', 'schema.yaml', 'schema.yml']), 'schema.')
})

Deno.test('getCommonPrefix - returns empty string when no common prefix', () => {
  assertEquals(getCommonPrefix(['apple.json', 'banana.yaml', 'cherry.yml']), '')
})

Deno.test('getCommonPrefix - handles case sensitivity', () => {
  assertEquals(getCommonPrefix(['Schema.json', 'schema.yaml']), '')
})

Deno.test('getCommonPrefix - finds longest common prefix', () => {
  assertEquals(getCommonPrefix(['testing123', 'testing456', 'testing789']), 'testing')
})

Deno.test('getCommonPrefix - handles partial matches', () => {
  assertEquals(
    getCommonPrefix(['src/components/', 'src/containers/', 'src/contexts/']),
    'src/co'
  )
})

// Tests for findSuggestionToApply
Deno.test('findSuggestionToApply - returns null for empty suggestions', () => {
  assertEquals(findSuggestionToApply('test', []), null)
})

Deno.test('findSuggestionToApply - returns single suggestion', () => {
  assertEquals(findSuggestionToApply('sch', ['schema.json']), 'schema.json')
})

Deno.test('findSuggestionToApply - returns common prefix if longer than input', () => {
  assertEquals(
    findSuggestionToApply('sch', ['schema.json', 'schema.yaml', 'schema.yml']),
    'schema.'
  )
})

Deno.test('findSuggestionToApply - returns null if common prefix not longer than input', () => {
  assertEquals(findSuggestionToApply('schema.', ['schema.json', 'schema.yaml']), null)
})

Deno.test('findSuggestionToApply - returns null when no common prefix', () => {
  assertEquals(findSuggestionToApply('s', ['apple.json', 'banana.yaml']), null)
})

Deno.test('findSuggestionToApply - handles exact match in suggestions', () => {
  // When user has already typed the full common prefix
  assertEquals(findSuggestionToApply('schema', ['schema.json', 'schema.yaml']), 'schema.')
})

// Tests for toRelativePath
Deno.test('toRelativePath - returns relative path for file inside basePath', async () => {
  const tempDir = await Deno.makeTempDir()
  try {
    const filePath = join(tempDir, 'schema.json')
    // Create the file so realPathSync works
    await Deno.writeTextFile(filePath, '{}')
    const result = toRelativePath(filePath, tempDir)
    assertEquals(result, 'schema.json')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toRelativePath - returns relative path for nested file', async () => {
  const tempDir = await Deno.makeTempDir()
  try {
    await Deno.mkdir(join(tempDir, 'schemas'))
    const filePath = join(tempDir, 'schemas', 'openapi.json')
    // Create the file so realPathSync works
    await Deno.writeTextFile(filePath, '{}')
    const result = toRelativePath(filePath, tempDir)
    assertEquals(result, join('schemas', 'openapi.json'))
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toRelativePath - returns absolute path for file outside basePath', async () => {
  const tempDir = await Deno.makeTempDir()
  try {
    const outsidePath = '/some/external/path/schema.json'
    const result = toRelativePath(outsidePath, tempDir)
    assertEquals(result, outsidePath)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toRelativePath - returns dot for same path as basePath', async () => {
  const tempDir = await Deno.makeTempDir()
  try {
    const result = toRelativePath(tempDir, tempDir)
    assertEquals(result, '.')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('toRelativePath - handles parent directory references', async () => {
  const tempDir = await Deno.makeTempDir()
  try {
    await Deno.mkdir(join(tempDir, 'project'))
    const basePath = join(tempDir, 'project')
    const parentFile = join(tempDir, 'schema.json')
    const result = toRelativePath(parentFile, basePath)
    // Should return absolute path since it goes outside basePath
    assertEquals(result, parentFile)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})