import { assertEquals } from '@std/assert/equals'
import { toGenerationStats, toManifestLines, toTotalTime, toManifestErrors, checkResult, toManifestTokens } from './generationStats.ts'
import type { ManifestContent } from '../types/Manifest.ts'

Deno.test('toManifestTokens - counts tokens in artifacts', () => {
  const artifacts = {
    './file1.ts': 'export const hello = "world";',
    './file2.ts': 'export const foo = "bar";'
  }

  const tokens = toManifestTokens(artifacts)

  assertEquals(typeof tokens, 'number')
  assertEquals(tokens > 0, true)
})

Deno.test('toManifestTokens - returns zero for empty artifacts', () => {
  const artifacts = {}

  const tokens = toManifestTokens(artifacts)

  assertEquals(tokens, 0)
})

Deno.test('toManifestLines - calculates total lines from manifest', () => {
  const manifest: Partial<ManifestContent> = {
    files: {
      './models.ts': { lines: 150, characters: 4500, destinationPath: './models.ts' },
      './types.ts': { lines: 80, characters: 2100, destinationPath: './types.ts' }
    }
  }

  assertEquals(toManifestLines(manifest as ManifestContent), 230)
})

Deno.test('toManifestLines - handles single file', () => {
  const manifest: Partial<ManifestContent> = {
    files: {
      './index.ts': { lines: 42, characters: 1200, destinationPath: './index.ts' }
    }
  }

  assertEquals(toManifestLines(manifest as ManifestContent), 42)
})

Deno.test('toManifestLines - handles empty files object', () => {
  const manifest = {
    files: {}
  } as ManifestContent

  assertEquals(toManifestLines(manifest), 0)
})

Deno.test('toTotalTime - calculates duration from timestamps', () => {
  const manifest = {
    startAt: 1672531200000,
    endAt: 1672531245000
  } as ManifestContent

  assertEquals(toTotalTime(manifest), 45000)
})

Deno.test('toTotalTime - handles zero duration', () => {
  const manifest = {
    startAt: 1000000,
    endAt: 1000000
  } as ManifestContent

  assertEquals(toTotalTime(manifest), 0)
})

Deno.test('toManifestErrors - extracts error paths from flat results', () => {
  const results = {
    'models.ts': 'error' as const
  }

  const errors = toManifestErrors(results)
  assertEquals(errors, [['models.ts']])
})

Deno.test('toManifestErrors - extracts multiple error paths', () => {
  const results = {
    'models.ts': 'error' as const,
    'types.ts': 'error' as const
  }

  const errors = toManifestErrors(results)
  assertEquals(errors, [['models.ts'], ['types.ts']])
})

Deno.test('toManifestErrors - ignores non-error results', () => {
  const results = {
    'models.ts': 'success' as const,
    'types.ts': 'warning' as const
  }

  const errors = toManifestErrors(results)
  assertEquals(errors, [])
})

Deno.test('toManifestErrors - extracts nested error paths', () => {
  const results = {
    'models.ts': {
      'User': 'success' as const,
      'Product': 'error' as const
    }
  }

  const errors = toManifestErrors(results)
  assertEquals(errors, [['models.ts', 'Product']])
})

Deno.test('toManifestErrors - handles deeply nested errors', () => {
  const results = {
    'generation': {
      'models': {
        'User': {
          'validation': 'error' as const
        }
      }
    }
  }

  const errors = toManifestErrors(results)
  assertEquals(errors, [['generation', 'models', 'User', 'validation']])
})

Deno.test('toManifestErrors - handles empty results', () => {
  const results = {}

  const errors = toManifestErrors(results)
  assertEquals(errors, [])
})

Deno.test('checkResult - identifies string error', () => {
  const errors: string[][] = []

  checkResult({
    path: ['test'],
    result: 'error' as const,
    errors
  })

  assertEquals(errors, [['test']])
})

Deno.test('checkResult - ignores non-error strings', () => {
  const errors: string[][] = []

  checkResult({
    path: ['test'],
    result: 'success' as const,
    errors
  })

  assertEquals(errors, [])
})

Deno.test('checkResult - traverses nested objects', () => {
  const errors: string[][] = []

  checkResult({
    path: ['root'],
    result: {
      'nested': 'error' as const
    },
    errors
  })

  assertEquals(errors, [['root', 'nested']])
})

Deno.test('checkResult - handles arrays', () => {
  const errors: string[][] = []

  checkResult({
    path: ['batch'],
    result: [
      { item: 'success' as const },
      { item: 'error' as const },
      { item: 'success' as const }
    ],
    errors
  })

  assertEquals(errors, [['batch', 'item']])
})

Deno.test('checkResult - handles null values in arrays', () => {
  const errors: string[][] = []

  checkResult({
    path: ['batch'],
    result: [
      { item: 'success' as const },
      null,
      { item: 'error' as const }
    ],
    errors
  })

  assertEquals(errors, [['batch', 'item']])
})

Deno.test('toGenerationStats - returns complete stats object', () => {
  const manifest: Partial<ManifestContent> = {
    startAt: 1672531200000,
    endAt: 1672531245000,
    files: {
      './models.ts': { lines: 100, characters: 3000, destinationPath: './models.ts' }
    },
    results: {}
  }

  const artifacts = {
    './models.ts': 'export interface User { id: string; }'
  }

  const stats = toGenerationStats({ manifest: manifest as ManifestContent, artifacts })

  assertEquals(stats.lines, 100)
  assertEquals(stats.totalTime, 45000)
  assertEquals(stats.errors, [])
  assertEquals(stats.files, 1)
  assertEquals(typeof stats.tokens, 'number')
})

Deno.test('toGenerationStats - counts multiple files', () => {
  const manifest: Partial<ManifestContent> = {
    startAt: 0,
    endAt: 1000,
    files: {
      './file1.ts': { lines: 50, characters: 1500, destinationPath: './file1.ts' },
      './file2.ts': { lines: 75, characters: 2250, destinationPath: './file2.ts' }
    },
    results: {}
  }

  const artifacts = {
    './file1.ts': 'content1',
    './file2.ts': 'content2'
  }

  const stats = toGenerationStats({ manifest: manifest as ManifestContent, artifacts })

  assertEquals(stats.files, 2)
  assertEquals(stats.lines, 125)
})

Deno.test('toGenerationStats - includes errors in stats', () => {
  const manifest: Partial<ManifestContent> = {
    startAt: 0,
    endAt: 1000,
    files: {
      './models.ts': { lines: 50, characters: 1500, destinationPath: './models.ts' }
    },
    results: {
      'models': {
        'User': 'error' as const,
        'Product': 'success' as const
      }
    }
  }

  const artifacts = {
    './models.ts': 'content'
  }

  const stats = toGenerationStats({ manifest: manifest as ManifestContent, artifacts })

  assertEquals(stats.errors, [['models', 'User']])
})
