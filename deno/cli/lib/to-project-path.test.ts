import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { toProjectPath } from '@/lib/to-project-path.ts'

Deno.test('toProjectPath - returns path to project directory', () => {
  const projectName = 'my-project'
  const path = toProjectPath(projectName)

  assertStringIncludes(path, '.skmtc')
  assertStringIncludes(path, projectName)
})

Deno.test('toProjectPath - handles project names with hyphens', () => {
  const projectName = 'my-cool-project'
  const path = toProjectPath(projectName)

  assertStringIncludes(path, 'my-cool-project')
})

Deno.test('toProjectPath - returns absolute path', () => {
  const projectName = 'test-project'
  const path = toProjectPath(projectName)

  // Absolute paths start with / on Unix or contain : on Windows
  const isAbsolute = path.startsWith('/') || path.includes(':')
  assertEquals(isAbsolute, true)
})
