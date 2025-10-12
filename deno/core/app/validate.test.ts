import { assertEquals } from '@std/assert/equals'
import { checkProjectName } from './validate.ts'

// Valid names
Deno.test('checkProjectName - valid 2 character name', () => {
  assertEquals(checkProjectName('ab'), undefined)
})

Deno.test('checkProjectName - valid 20 character name', () => {
  assertEquals(checkProjectName('a'.repeat(20)), undefined)
})

Deno.test('checkProjectName - valid name with letters only', () => {
  assertEquals(checkProjectName('myproject'), undefined)
})

Deno.test('checkProjectName - valid name with numbers', () => {
  assertEquals(checkProjectName('api2'), undefined)
})

Deno.test('checkProjectName - valid name with hyphens', () => {
  assertEquals(checkProjectName('my-api-client'), undefined)
})

// Length validation
Deno.test('checkProjectName - too short (1 character)', () => {
  assertEquals(checkProjectName('a'), 'Name must be at least 2 characters long')
})

Deno.test('checkProjectName - too long (21 characters)', () => {
  assertEquals(checkProjectName('a'.repeat(21)), 'Name must be 20 characters or less')
})

Deno.test('checkProjectName - empty string', () => {
  assertEquals(checkProjectName(''), 'Name must be at least 2 characters long')
})

// Character validation
Deno.test('checkProjectName - uppercase letters not allowed', () => {
  assertEquals(checkProjectName('MyProject'), 'Name must only contain lowercase letters, numbers and hyphens')
})

Deno.test('checkProjectName - spaces not allowed', () => {
  assertEquals(checkProjectName('my project'), 'Name must only contain lowercase letters, numbers and hyphens')
})

Deno.test('checkProjectName - underscores not allowed', () => {
  assertEquals(checkProjectName('my_project'), 'Name must only contain lowercase letters, numbers and hyphens')
})

Deno.test('checkProjectName - special characters not allowed', () => {
  assertEquals(checkProjectName('my@project'), 'Name must only contain lowercase letters, numbers and hyphens')
})

// Hyphen position validation
Deno.test('checkProjectName - cannot start with hyphen', () => {
  assertEquals(checkProjectName('-myproject'), 'Name cannot start with a hyphen')
})

Deno.test('checkProjectName - cannot end with hyphen', () => {
  assertEquals(checkProjectName('myproject-'), 'Name cannot end with a hyphen')
})

Deno.test('checkProjectName - cannot start and end with hyphen', () => {
  assertEquals(checkProjectName('-myproject-'), 'Name cannot start with a hyphen')
})

Deno.test('checkProjectName - multiple hyphens in middle are valid', () => {
  assertEquals(checkProjectName('my-api-client'), undefined)
})
