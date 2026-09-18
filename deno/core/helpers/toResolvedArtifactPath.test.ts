import { assertEquals, assertThrows } from '@std/assert'
import { toResolvedArtifactPath } from './toResolvedArtifactPath.ts'

Deno.test('toResolvedArtifactPath - joins base path with destination', () => {
  const result = toResolvedArtifactPath({
    basePath: './src/generated',
    destinationPath: 'models/User.ts'
  })
  assertEquals(result, 'src/generated/models/User.ts')
})

Deno.test('toResolvedArtifactPath - uses default base when undefined', () => {
  const result = toResolvedArtifactPath({
    basePath: undefined,
    destinationPath: 'types.ts'
  })
  assertEquals(result, 'types.ts')
})

Deno.test('toResolvedArtifactPath - strips @/ prefix from destination', () => {
  const result = toResolvedArtifactPath({
    basePath: './output',
    destinationPath: '@/api/models.ts'
  })
  assertEquals(result, 'output/api/models.ts')
})

Deno.test('toResolvedArtifactPath - handles @/ with undefined base', () => {
  const result = toResolvedArtifactPath({
    basePath: undefined,
    destinationPath: '@/components/Button.tsx'
  })
  assertEquals(result, 'components/Button.tsx')
})

Deno.test('toResolvedArtifactPath - handles nested directories', () => {
  const result = toResolvedArtifactPath({
    basePath: './build',
    destinationPath: 'utils/helpers/format.js'
  })
  assertEquals(result, 'build/utils/helpers/format.js')
})

Deno.test('toResolvedArtifactPath - handles single file in base', () => {
  const result = toResolvedArtifactPath({
    basePath: './dist',
    destinationPath: 'index.ts'
  })
  assertEquals(result, 'dist/index.ts')
})

Deno.test('toResolvedArtifactPath - handles empty string base', () => {
  const result = toResolvedArtifactPath({
    basePath: '',
    destinationPath: 'file.ts'
  })
  assertEquals(result, 'file.ts')
})

Deno.test('toResolvedArtifactPath - handles relative destination path', () => {
  const result = toResolvedArtifactPath({
    basePath: './src',
    destinationPath: './generated/api.ts'
  })
  assertEquals(result, 'src/generated/api.ts')
})

Deno.test('toResolvedArtifactPath - handles multiple @/ in path', () => {
  const result = toResolvedArtifactPath({
    basePath: './base',
    destinationPath: '@/path/@/file.ts'
  })
  // Only first @/ is stripped
  assertEquals(result, 'base/path/@/file.ts')
})

Deno.test('toResolvedArtifactPath - a Windows-spelled destination resolves to the same key', () => {
  assertEquals(
    toResolvedArtifactPath({ basePath: './src', destinationPath: '@\\types\\x.ts' }),
    'src/types/x.ts'
  )
  assertEquals(
    toResolvedArtifactPath({ basePath: undefined, destinationPath: 'types\\x.ts' }),
    'types/x.ts'
  )
})

Deno.test('toResolvedArtifactPath - a Windows-spelled basePath resolves to the same key', () => {
  assertEquals(
    toResolvedArtifactPath({ basePath: '.\\src\\generated', destinationPath: '@/x.ts' }),
    'src/generated/x.ts'
  )
})

Deno.test('toResolvedArtifactPath - the key never contains a backslash, on any host', () => {
  const key = toResolvedArtifactPath({ basePath: './src', destinationPath: '@/a/b/c.ts' })
  assertEquals(key.includes('\\'), false)
  assertEquals(key, 'src/a/b/c.ts')
})

Deno.test('toResolvedArtifactPath - a destination that escapes basePath is refused', () => {
  assertThrows(() => toResolvedArtifactPath({ basePath: './src', destinationPath: '../x.ts' }))
  assertThrows(() =>
    toResolvedArtifactPath({ basePath: './src', destinationPath: 'types/../../x.ts' })
  )
  assertThrows(() => toResolvedArtifactPath({ basePath: undefined, destinationPath: '../x.ts' }))
})
