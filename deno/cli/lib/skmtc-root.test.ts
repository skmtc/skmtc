import { assertEquals, assertRejects } from '@std/assert'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Project, isProjectKey } from '@/lib/project.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'

Deno.test('SkmtcRoot.toPath - returns .skmtc directory path', () => {
  const path = SkmtcRoot.toPath()

  assertEquals(path.endsWith('.skmtc'), true)
})

Deno.test('SkmtcRoot.findProject - finds existing project by name', async () => {
  const manager = createMockManager()
  const skmtcRoot = new (SkmtcRoot as any)([], manager)

  // Add mock projects
  const mockProject1 = { name: 'project-one' } as Project
  const mockProject2 = { name: 'project-two' } as Project
  skmtcRoot.projects = [mockProject1, mockProject2]

  const found = skmtcRoot.findProject('project-two')

  assertEquals(found, mockProject2)
})
Deno.test('SkmtcRoot.findProject - throws error when project not found', async () => {
  const manager = createMockManager()
  const skmtcRoot = new (SkmtcRoot as any)([], manager)
  skmtcRoot.projects = []

  try {
    skmtcRoot.findProject('non-existent')
    throw new Error('Should have thrown')
  } catch (error) {
    assertEquals((error as Error).message.includes('not found'), true)
  }
})

Deno.test('SkmtcRoot.isLoggedIn - returns auth status', async () => {
  const manager = createMockManager()
  manager.auth.isLoggedIn = async () => true

  const skmtcRoot = new (SkmtcRoot as any)([], manager)

  assertEquals(await skmtcRoot.isLoggedIn, true)
})

Deno.test('SkmtcRoot.isLoggedIn - returns false when not logged in', async () => {
  const manager = createMockManager()
  manager.auth.isLoggedIn = async () => false

  const skmtcRoot = new (SkmtcRoot as any)([], manager)

  assertEquals(await skmtcRoot.isLoggedIn, false)
})

// Tests for isProjectKey helper function (used by toProject)
Deno.test('isProjectKey - validates project key format for remote projects', () => {
  assertEquals(isProjectKey('@account/project'), true)
  assertEquals(isProjectKey('local-project'), false)
})

Deno.test('isProjectKey - ensures minimum lengths for account and project', () => {
  // Account needs 4+ chars (including @), project needs 3+ chars
  assertEquals(isProjectKey('@abcd/abc'), true)
  assertEquals(isProjectKey('@ab/project'), false) // Account too short (@ab = 3 chars)
  assertEquals(isProjectKey('@account/ab'), false) // Project too short (ab = 2 chars)
})

Deno.test('isProjectKey - rejects project names starting with gen-', () => {
  try {
    isProjectKey('@account/gen-something')
    throw new Error('Should have thrown')
  } catch (error) {
    assertEquals((error as Error).message.includes('gen-'), true)
  }
})

Deno.test('SkmtcRoot - constructor initializes with projects and manager', () => {
  const manager = createMockManager()
  const mockProjects = [{ name: 'project1' } as Project, { name: 'project2' } as Project]

  const skmtcRoot = new (SkmtcRoot as any)(mockProjects, manager)

  assertEquals(skmtcRoot.projects.length, 2)
  assertEquals(skmtcRoot.manager, manager)
  assertEquals(skmtcRoot.apiClient !== undefined, true)
})

Deno.test('SkmtcRoot - multiple projects can coexist', () => {
  const manager = createMockManager()
  const projects = [
    { name: 'api-project' } as Project,
    { name: 'web-project' } as Project,
    { name: 'mobile-project' } as Project
  ]

  const skmtcRoot = new (SkmtcRoot as any)(projects, manager)

  assertEquals(skmtcRoot.findProject('api-project').name, 'api-project')
  assertEquals(skmtcRoot.findProject('web-project').name, 'web-project')
  assertEquals(skmtcRoot.findProject('mobile-project').name, 'mobile-project')
})

Deno.test('SkmtcRoot.findProject - case sensitive project name matching', () => {
  const manager = createMockManager()
  const mockProject = { name: 'MyProject' } as Project
  const skmtcRoot = new (SkmtcRoot as any)([mockProject], manager)

  // Should find exact match
  assertEquals(skmtcRoot.findProject('MyProject'), mockProject)

  // Should not find different case
  try {
    skmtcRoot.findProject('myproject')
    throw new Error('Should have thrown')
  } catch (error) {
    assertEquals((error as Error).message.includes('not found'), true)
  }
})

Deno.test('SkmtcRoot - empty projects array is valid', () => {
  const manager = createMockManager()
  const skmtcRoot = new (SkmtcRoot as any)([], manager)

  assertEquals(skmtcRoot.projects.length, 0)
})

Deno.test('SkmtcRoot.findProject - handles special characters in project names', () => {
  const manager = createMockManager()
  const mockProject = { name: 'my-project-v2' } as Project
  const skmtcRoot = new (SkmtcRoot as any)([mockProject], manager)

  const found = skmtcRoot.findProject('my-project-v2')

  assertEquals(found.name, 'my-project-v2')
})
