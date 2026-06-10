import { assertEquals } from '@std/assert'
import { getDependencyIds } from '@/lib/project.ts'
import type { Generator } from '@/types/generator.generated.ts'
// Helper to create a mock generator
const createMockGenerator = (
  id: string,
  scope: string,
  packageName: string,
  dependencies: string[] = []
): Generator => ({
  id,
  name: packageName,
  scope,
  packageName,
  dependencies,
  description: 'Test generator',
  sourceUrl: 'https://github.com/test',
  registryUrl: `jsr:@${scope}/${packageName}`,
  readme: 'Test readme',
  createdAt: '2024-01-01'
})
// Tests for getDependencyIds utility function
Deno.test('getDependencyIds - returns original set when no dependencies', () => {
  const options: Generator[] = [createMockGenerator('gen-1', 'skmtc', 'generator-one', [])]

  const result = getDependencyIds({
    checkedIds: new Set(),
    options,
    generatorIds: new Set(['@skmtc/generator-one'])
  })

  assertEquals(result.size, 1)
  assertEquals(result.has('@skmtc/generator-one'), true)
})

Deno.test('getDependencyIds - adds single level dependencies', () => {
  const options: Generator[] = [
    createMockGenerator('gen-1', 'skmtc', 'generator-one', ['@skmtc/dep-one']),
    createMockGenerator('gen-2', 'skmtc', 'dep-one', [])
  ]

  const result = getDependencyIds({
    checkedIds: new Set(),
    options,
    generatorIds: new Set(['@skmtc/generator-one'])
  })

  assertEquals(result.size, 2)
  assertEquals(result.has('@skmtc/generator-one'), true)
  assertEquals(result.has('@skmtc/dep-one'), true)
})

Deno.test('getDependencyIds - handles nested dependencies recursively', () => {
  const options: Generator[] = [
    createMockGenerator('gen-1', 'skmtc', 'generator-one', ['@skmtc/dep-one']),
    createMockGenerator('gen-2', 'skmtc', 'dep-one', ['@skmtc/dep-two']),
    createMockGenerator('gen-3', 'skmtc', 'dep-two', [])
  ]

  const result = getDependencyIds({
    checkedIds: new Set(),
    options,
    generatorIds: new Set(['@skmtc/generator-one'])
  })

  assertEquals(result.size, 3)
  assertEquals(result.has('@skmtc/generator-one'), true)
  assertEquals(result.has('@skmtc/dep-one'), true)
  assertEquals(result.has('@skmtc/dep-two'), true)
})

Deno.test('getDependencyIds - handles multiple initial generators', () => {
  const options: Generator[] = [
    createMockGenerator('gen-1', 'skmtc', 'generator-one', ['@skmtc/shared-dep']),
    createMockGenerator('gen-2', 'skmtc', 'generator-two', ['@skmtc/shared-dep']),
    createMockGenerator('gen-3', 'skmtc', 'shared-dep', [])
  ]

  const result = getDependencyIds({
    checkedIds: new Set(),
    options,
    generatorIds: new Set(['@skmtc/generator-one', '@skmtc/generator-two'])
  })

  assertEquals(result.size, 3)
  assertEquals(result.has('@skmtc/generator-one'), true)
  assertEquals(result.has('@skmtc/generator-two'), true)
  assertEquals(result.has('@skmtc/shared-dep'), true)
})

Deno.test('getDependencyIds - avoids infinite loops with circular dependencies', () => {
  const options: Generator[] = [
    createMockGenerator('gen-1', 'skmtc', 'generator-one', ['@skmtc/dep-one']),
    createMockGenerator('gen-2', 'skmtc', 'dep-one', ['@skmtc/generator-one']) // Circular reference
  ]

  const result = getDependencyIds({
    checkedIds: new Set(),
    options,
    generatorIds: new Set(['@skmtc/generator-one'])
  })

  // Should not hang and should include both
  assertEquals(result.size, 2)
  assertEquals(result.has('@skmtc/generator-one'), true)
  assertEquals(result.has('@skmtc/dep-one'), true)
})

Deno.test('getDependencyIds - skips generators not in initial set', () => {
  const options: Generator[] = [
    createMockGenerator('gen-1', 'skmtc', 'generator-one', []),
    createMockGenerator('gen-2', 'skmtc', 'generator-two', [])
  ]

  const result = getDependencyIds({
    checkedIds: new Set(),
    options,
    generatorIds: new Set(['@skmtc/generator-one'])
  })

  assertEquals(result.size, 1)
  assertEquals(result.has('@skmtc/generator-one'), true)
  assertEquals(result.has('@skmtc/generator-two'), false)
})

