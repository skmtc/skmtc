import { assertEquals, assertThrows } from '@std/assert'
import { getDependencyIds, isProjectKey, toProjectKey } from '@/lib/project.ts'
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

// Tests for isProjectKey utility function
Deno.test('isProjectKey - returns true for valid project key', () => {
  assertEquals(isProjectKey('@user/project'), true)
})

Deno.test('isProjectKey - returns true for valid key with long names', () => {
  assertEquals(isProjectKey('@username/my-project-name'), true)
})

Deno.test('isProjectKey - returns false for missing @ prefix', () => {
  assertEquals(isProjectKey('user/project'), false)
})

Deno.test('isProjectKey - returns false for missing slash', () => {
  assertEquals(isProjectKey('@userproject'), false)
})

Deno.test('isProjectKey - returns false for too many slashes', () => {
  assertEquals(isProjectKey('@user/project/extra'), false)
})

Deno.test('isProjectKey - returns false for short account name', () => {
  assertEquals(isProjectKey('@ab/project'), false)
})

Deno.test('isProjectKey - returns false for short project name', () => {
  assertEquals(isProjectKey('@user/pr'), false)
})

Deno.test('isProjectKey - throws error for gen- prefix', () => {
  assertThrows(
    () => {
      isProjectKey('@user/gen-project')
    },
    Error,
    'Project name cannot start with "gen-"'
  )
})

Deno.test('isProjectKey - returns true for exactly minimum lengths', () => {
  assertEquals(isProjectKey('@abcd/abc'), true)
})

// Tests for toProjectKey utility function
Deno.test('toProjectKey - returns project key for valid string', () => {
  const result = toProjectKey('@user/project')

  assertEquals(result, '@user/project')
})

Deno.test('toProjectKey - throws error for invalid format', () => {
  assertThrows(
    () => {
      toProjectKey('invalid')
    },
    Error,
    'Project key must be in the format "@<accountName>/<projectName>"'
  )
})

Deno.test('toProjectKey - throws error for missing @ prefix', () => {
  assertThrows(
    () => {
      toProjectKey('user/project')
    },
    Error,
    'Project key must be in the format "@<accountName>/<projectName>"'
  )
})

Deno.test('toProjectKey - throws error for short names', () => {
  assertThrows(
    () => {
      toProjectKey('@ab/project')
    },
    Error,
    'Project key must be in the format "@<accountName>/<projectName>"'
  )
})

Deno.test('toProjectKey - preserves type for valid keys', () => {
  const key = '@username/my-project'
  const result = toProjectKey(key)

  // Type assertion to verify it returns ProjectKey type
  const typed: typeof result extends `@${string}/${string}` ? true : false = true
  assertEquals(typed, true)
  assertEquals(result, key)
})
