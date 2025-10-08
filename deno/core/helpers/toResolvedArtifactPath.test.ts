import { assertEquals } from '@std/assert/equals'
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
