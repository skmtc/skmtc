import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { toRemoteProjectPath } from '@/lib/to-remote-project-path.ts'
import type { ProjectKey } from '@/lib/project.ts'

Deno.test('toRemoteProjectPath - parses account and project name', () => {
  const projectKey: ProjectKey = '@myaccount/my-project' as ProjectKey
  const path = toRemoteProjectPath(projectKey)

  assertStringIncludes(path, 'myaccount')
  assertStringIncludes(path, 'my-project')
})

Deno.test('toRemoteProjectPath - includes .skmtc in path', () => {
  const projectKey: ProjectKey = '@testorg/testproject' as ProjectKey
  const path = toRemoteProjectPath(projectKey)

  assertStringIncludes(path, '.skmtc')
})

Deno.test('toRemoteProjectPath - returns absolute path', () => {
  const projectKey: ProjectKey = '@org/proj' as ProjectKey
  const path = toRemoteProjectPath(projectKey)

  const isAbsolute = path.startsWith('/') || path.includes(':')
  assertEquals(isAbsolute, true)
})
