import { assertEquals } from '@std/assert'
import { validateProjectName } from './validate-project-name.ts'

// ============================================================================
// Length Validation Tests
// ============================================================================

Deno.test('validateProjectName - rejects empty string', () => {
  const result = validateProjectName('', [])

  assertEquals(result.valid, false)
  if (!result.valid) {
    assertEquals(result.error, 'Project name must be at least 3 characters long')
  }
})

Deno.test('validateProjectName - rejects 1 character name', () => {
  const result = validateProjectName('a', [])

  assertEquals(result.valid, false)
  if (!result.valid) {
    assertEquals(result.error, 'Project name must be at least 3 characters long')
  }
})

Deno.test('validateProjectName - rejects 2 character name', () => {
  const result = validateProjectName('ab', [])

  assertEquals(result.valid, false)
  if (!result.valid) {
    assertEquals(result.error, 'Project name must be at least 3 characters long')
  }
})

Deno.test('validateProjectName - accepts exactly 3 characters (minimum valid)', () => {
  const result = validateProjectName('abc', [])

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, 'abc')
  }
})

Deno.test('validateProjectName - accepts 4+ character name', () => {
  const result = validateProjectName('my-project', [])

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, 'my-project')
  }
})

// ============================================================================
// Duplicate Validation Tests
// ============================================================================

Deno.test('validateProjectName - rejects duplicate name', () => {
  const existingNames = ['project-1', 'project-2', 'project-3']
  const result = validateProjectName('project-2', existingNames)

  assertEquals(result.valid, false)
  if (!result.valid) {
    assertEquals(result.error, 'Project "project-2" already exists')
  }
})

Deno.test('validateProjectName - rejects duplicate from beginning of list', () => {
  const existingNames = ['first-project', 'second-project']
  const result = validateProjectName('first-project', existingNames)

  assertEquals(result.valid, false)
  if (!result.valid) {
    assertEquals(result.error, 'Project "first-project" already exists')
  }
})

Deno.test('validateProjectName - rejects duplicate from end of list', () => {
  const existingNames = ['first-project', 'second-project', 'last-project']
  const result = validateProjectName('last-project', existingNames)

  assertEquals(result.valid, false)
  if (!result.valid) {
    assertEquals(result.error, 'Project "last-project" already exists')
  }
})

Deno.test('validateProjectName - duplicate check is case sensitive (different case allowed)', () => {
  const existingNames = ['myproject']
  const result = validateProjectName('MyProject', existingNames)

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, 'MyProject')
  }
})

Deno.test('validateProjectName - accepts name not in existing list', () => {
  const existingNames = ['project-1', 'project-2']
  const result = validateProjectName('new-project', existingNames)

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, 'new-project')
  }
})

// ============================================================================
// Empty List Tests
// ============================================================================

Deno.test('validateProjectName - accepts any valid name when no existing projects', () => {
  const result = validateProjectName('first-project', [])

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, 'first-project')
  }
})

Deno.test('validateProjectName - still enforces length with empty list', () => {
  const result = validateProjectName('ab', [])

  assertEquals(result.valid, false)
  if (!result.valid) {
    assertEquals(result.error, 'Project name must be at least 3 characters long')
  }
})

// ============================================================================
// Special Characters and Edge Cases
// ============================================================================

Deno.test('validateProjectName - accepts name with hyphens', () => {
  const result = validateProjectName('my-awesome-project', [])

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, 'my-awesome-project')
  }
})

Deno.test('validateProjectName - accepts name with numbers', () => {
  const result = validateProjectName('project-2024', [])

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, 'project-2024')
  }
})

Deno.test('validateProjectName - accepts name with underscores', () => {
  const result = validateProjectName('my_project', [])

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, 'my_project')
  }
})

Deno.test('validateProjectName - accepts long project name', () => {
  const longName = 'my-very-long-project-name-with-many-words-and-numbers-2024'
  const result = validateProjectName(longName, [])

  assertEquals(result.valid, true)
  if (result.valid) {
    assertEquals(result.value, longName)
  }
})

// ============================================================================
// Validation Order Tests
// ============================================================================

Deno.test('validateProjectName - checks length before duplicate (both invalid)', () => {
  // Name is both too short AND exists in list
  // Should fail on length validation first
  const existingNames = ['ab']
  const result = validateProjectName('ab', existingNames)

  assertEquals(result.valid, false)
  if (!result.valid) {
    // Should show length error, not duplicate error
    assertEquals(result.error, 'Project name must be at least 3 characters long')
  }
})

Deno.test('validateProjectName - checks duplicate after length passes', () => {
  // Name is long enough but is a duplicate
  const existingNames = ['valid-project']
  const result = validateProjectName('valid-project', existingNames)

  assertEquals(result.valid, false)
  if (!result.valid) {
    // Should show duplicate error
    assertEquals(result.error, 'Project "valid-project" already exists')
  }
})

// ============================================================================
// Type Guard Tests (Return Type Verification)
// ============================================================================

Deno.test('validateProjectName - valid result has value property', () => {
  const result = validateProjectName('test', [])

  if (result.valid) {
    // TypeScript should know result.value exists
    const value: string = result.value
    assertEquals(value, 'test')
  } else {
    throw new Error('Expected valid result')
  }
})

Deno.test('validateProjectName - invalid result has error property', () => {
  const result = validateProjectName('ab', [])

  if (!result.valid) {
    // TypeScript should know result.error exists
    const error: string = result.error
    assertEquals(typeof error, 'string')
  } else {
    throw new Error('Expected invalid result')
  }
})
