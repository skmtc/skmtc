import { assertEquals, assertRejects } from '@std/assert'
import { stub, type Stub, assertSpyCalls } from '@std/testing/mock'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Project, isProjectKey } from '@/lib/project.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { Jsr } from '@/lib/jsr.ts'
import { RemoteProject } from '@/lib/remote-project.ts'
import { SchemaFile } from '@/lib/schema-file.ts'

Deno.test('SkmtcRoot.toPath - returns .skmtc directory path', () => {
  const path = SkmtcRoot.toPath()

  assertEquals(path.endsWith('.skmtc'), true)
})

Deno.test('SkmtcRoot.findProject - finds existing project by name', async () => {
  const manager = createMockManager()
  const mockProject1 = { name: 'project-one' } as Project
  const mockProject2 = { name: 'project-two' } as Project
  const skmtcRoot = new SkmtcRoot([mockProject1, mockProject2], manager)

  const found = skmtcRoot.findProject('project-two')

  assertEquals(found, mockProject2)
})
Deno.test('SkmtcRoot.findProject - throws error when project not found', async () => {
  const manager = createMockManager()
  const skmtcRoot = new SkmtcRoot([], manager)

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

  const skmtcRoot = new SkmtcRoot([], manager)

  assertEquals(await skmtcRoot.isLoggedIn, true)
})

Deno.test('SkmtcRoot.isLoggedIn - returns false when not logged in', async () => {
  const manager = createMockManager()
  manager.auth.isLoggedIn = async () => false

  const skmtcRoot = new SkmtcRoot([], manager)

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

  const skmtcRoot = new SkmtcRoot(mockProjects, manager)

  assertEquals(skmtcRoot.projects.length, 2)
  assertEquals(skmtcRoot.manager, manager)
})

Deno.test('SkmtcRoot - multiple projects can coexist', () => {
  const manager = createMockManager()
  const projects = [
    { name: 'api-project' } as Project,
    { name: 'web-project' } as Project,
    { name: 'mobile-project' } as Project
  ]

  const skmtcRoot = new SkmtcRoot(projects, manager)

  assertEquals(skmtcRoot.findProject('api-project').name, 'api-project')
  assertEquals(skmtcRoot.findProject('web-project').name, 'web-project')
  assertEquals(skmtcRoot.findProject('mobile-project').name, 'mobile-project')
})

Deno.test('SkmtcRoot.findProject - case sensitive project name matching', () => {
  const manager = createMockManager()
  const mockProject = { name: 'MyProject' } as Project
  const skmtcRoot = new SkmtcRoot([mockProject], manager)

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
  const skmtcRoot = new SkmtcRoot([], manager)

  assertEquals(skmtcRoot.projects.length, 0)
})

Deno.test('SkmtcRoot.findProject - handles special characters in project names', () => {
  const manager = createMockManager()
  const mockProject = { name: 'my-project-v2' } as Project
  const skmtcRoot = new SkmtcRoot([mockProject], manager)

  const found = skmtcRoot.findProject('my-project-v2')

  assertEquals(found.name, 'my-project-v2')
})

// Tests for upgradeCheck method
Deno.test('SkmtcRoot.upgradeCheck - does not log when up to date', async () => {
  const manager = createMockManager()
  const skmtcRoot = new SkmtcRoot([], manager)

  // Mock Jsr to return same version
  const jsrStub = stub(
    Jsr,
    'getLatestMeta',
    () =>
      Promise.resolve({
        latest: '0.0.1',
        scope: 'skmtc',
        name: 'cli',
        versions: {}
      })
  )

  // Mock console.log to verify it's not called
  const consoleStub = stub(console, 'log')

  try {
    await skmtcRoot.upgradeCheck()

    // Should not log anything when up to date
    assertSpyCalls(consoleStub, 0)
  } finally {
    jsrStub.restore()
    consoleStub.restore()
  }
})

Deno.test('SkmtcRoot.upgradeCheck - logs when upgrade available', async () => {
  const manager = createMockManager()
  const skmtcRoot = new SkmtcRoot([], manager)

  // Mock Jsr to return newer version
  const jsrStub = stub(
    Jsr,
    'getLatestMeta',
    () =>
      Promise.resolve({
        latest: '99.99.99',
        scope: 'skmtc',
        name: 'cli',
        versions: {}
      })
  )

  // Mock console.log to capture message
  const consoleStub = stub(console, 'log')

  try {
    await skmtcRoot.upgradeCheck()

    // Should log upgrade message
    assertSpyCalls(consoleStub, 1)
    const logMessage = consoleStub.calls[0].args[0] as string
    assertEquals(logMessage.includes('99.99.99'), true)
    assertEquals(logMessage.includes('available'), true)
  } finally {
    jsrStub.restore()
    consoleStub.restore()
  }
})

// Tests for login method
Deno.test('SkmtcRoot.login - calls manager.auth.login', async () => {
  const manager = createMockManager()
  let loginCalled = false
  manager.auth.login = async () => {
    loginCalled = true
    return {} as any // Return mock Session
  }

  const skmtcRoot = new SkmtcRoot([], manager)

  await skmtcRoot.login()

  assertEquals(loginCalled, true)
})

// Tests for logout method
Deno.test('SkmtcRoot.logout - calls manager.auth.logout with silent: true', async () => {
  const manager = createMockManager()
  let logoutArgs: { silent: boolean } | undefined
  manager.auth.logout = async (args: { silent: boolean }) => {
    logoutArgs = args
  }

  const skmtcRoot = new SkmtcRoot([], manager)

  await skmtcRoot.logout({ silent: true })

  assertEquals(logoutArgs?.silent, true)
})

Deno.test('SkmtcRoot.logout - calls manager.auth.logout with silent: false', async () => {
  const manager = createMockManager()
  let logoutArgs: { silent: boolean } | undefined
  manager.auth.logout = async (args: { silent: boolean }) => {
    logoutArgs = args
  }

  const skmtcRoot = new SkmtcRoot([], manager)

  await skmtcRoot.logout({ silent: false })

  assertEquals(logoutArgs?.silent, false)
})

// Tests for toProject method
Deno.test('SkmtcRoot.toProject - returns RemoteProject for project key format', async () => {
  const manager = createMockManager()
  const skmtcRoot = new SkmtcRoot([], manager)

  const mockRemoteProject = { name: 'remote-project', isRemote: () => true }
  const mockSchemaFile = { path: 'schema.yaml' }

  const schemaFileStub = stub(
    SchemaFile,
    'create',
    () => mockSchemaFile as any
  )

  const remoteProjectStub = stub(
    RemoteProject,
    'fromKey',
    () => Promise.resolve(mockRemoteProject as any)
  )

  try {
    const result = await skmtcRoot.toProject({
      projectName: '@account/my-server',
      schemaPath: undefined
    })

    assertEquals(result, mockRemoteProject)
    assertSpyCalls(remoteProjectStub, 1)
    assertEquals(remoteProjectStub.calls[0].args[0].projectKey, '@account/my-server')
  } finally {
    schemaFileStub.restore()
    remoteProjectStub.restore()
  }
})

Deno.test('SkmtcRoot.toProject - returns local project for non-key format', async () => {
  const manager = createMockManager()
  const mockProject = { name: 'local-project' } as Project
  const skmtcRoot = new SkmtcRoot([mockProject], manager)

  const result = await skmtcRoot.toProject({
    projectName: 'local-project',
    schemaPath: undefined
  })

  assertEquals(result, mockProject)
})

Deno.test('SkmtcRoot.toProject - loads schema from path for remote project', async () => {
  const manager = createMockManager()
  const skmtcRoot = new SkmtcRoot([], manager)

  const mockRemoteProject = { name: 'remote-project', isRemote: () => true }
  const mockSchemaFile = { path: 'custom-schema.yaml' }

  const schemaFileStub = stub(
    SchemaFile,
    'openFromSource',
    () => Promise.resolve(mockSchemaFile as any)
  )

  const remoteProjectStub = stub(
    RemoteProject,
    'fromKey',
    () => Promise.resolve(mockRemoteProject as any)
  )

  try {
    await skmtcRoot.toProject({
      projectName: '@account/project',
      schemaPath: 'custom-schema.yaml'
    })

    assertSpyCalls(schemaFileStub, 1)
    assertEquals(schemaFileStub.calls[0].args[0], 'custom-schema.yaml')
  } finally {
    schemaFileStub.restore()
    remoteProjectStub.restore()
  }
})

// Tests for createProject method
Deno.test('SkmtcRoot.createProject - creates project and adds to projects array', async () => {
  const manager = createMockManager()
  const skmtcRoot = new SkmtcRoot([], manager)

  const mockProject = { name: 'new-project' } as Project

  const projectCreateStub = stub(
    Project,
    'create',
    () => Promise.resolve(mockProject)
  )

  try {
    const result = await skmtcRoot.createProject({
      name: 'new-project',
      basePath: '/api',
      generators: ['@skmtc/shadcn-ui'],
      availableGenerators: []
    })

    assertEquals(result, mockProject)
    assertEquals(skmtcRoot.projects.length, 1)
    assertEquals(skmtcRoot.projects[0], mockProject)
  } finally {
    projectCreateStub.restore()
  }
})

Deno.test('SkmtcRoot.createProject - calls manager.cleanup after creation', async () => {
  const manager = createMockManager()
  let cleanupCalled = false
  manager.cleanup = async () => {
    cleanupCalled = true
  }

  const skmtcRoot = new SkmtcRoot([], manager)

  const mockProject = { name: 'new-project' } as Project
  const projectCreateStub = stub(
    Project,
    'create',
    () => Promise.resolve(mockProject)
  )

  try {
    await skmtcRoot.createProject({
      name: 'new-project',
      basePath: '/api',
      generators: [],
      availableGenerators: []
    })

    assertEquals(cleanupCalled, true)
  } finally {
    projectCreateStub.restore()
  }
})

// Tests for SkmtcRoot.open static method
// Note: Testing when directory doesn't exist requires mocking file system calls
// which is challenging with Deno's module system. This is better tested through
// integration tests. The filtering and project loading logic is tested below.

Deno.test('SkmtcRoot.open - loads projects from directory', async () => {
  const manager = createMockManager()

  const mockDirEntries = [
    { name: 'project1', isDirectory: true, isFile: false, isSymlink: false },
    { name: 'project2', isDirectory: true, isFile: false, isSymlink: false },
    { name: '@scoped', isDirectory: true, isFile: false, isSymlink: false }, // Should be filtered out
    { name: 'file.txt', isDirectory: false, isFile: true, isSymlink: false } // Should be filtered out
  ]

  const mockProject1 = { name: 'project1' } as Project
  const mockProject2 = { name: 'project2' } as Project

  // Stub checkRootExists to return true so the test proceeds
  const existsStub = stub(
    SkmtcRoot,
    'checkRootExists',
    () => Promise.resolve(true)
  )

  const readDirStub = stub(
    Deno,
    'readDirSync',
    function* () {
      yield* mockDirEntries
    }
  )

  const projectOpenStub = stub(
    Project,
    'open',
    (name: string) => {
      if (name === 'project1') return Promise.resolve(mockProject1)
      if (name === 'project2') return Promise.resolve(mockProject2)
      throw new Error('Unexpected project name')
    }
  )

  try {
    const result = await SkmtcRoot.open(manager)

    // Should have 2 projects (filtered out @scoped and file.txt)
    assertEquals(result.projects.length, 2)
    assertEquals(result.projects[0], mockProject1)
    assertEquals(result.projects[1], mockProject2)
  } finally {
    existsStub.restore()
    readDirStub.restore()
    projectOpenStub.restore()
  }
})

Deno.test('SkmtcRoot.open - filters out @ prefixed directories', async () => {
  const manager = createMockManager()

  const mockDirEntries = [
    { name: '@types', isDirectory: true, isFile: false, isSymlink: false },
    { name: '@scope', isDirectory: true, isFile: false, isSymlink: false },
    { name: 'valid-project', isDirectory: true, isFile: false, isSymlink: false }
  ]

  const mockProject = { name: 'valid-project' } as Project

  // Stub checkRootExists to return true so the test proceeds
  const existsStub = stub(
    SkmtcRoot,
    'checkRootExists',
    () => Promise.resolve(true)
  )

  const readDirStub = stub(
    Deno,
    'readDirSync',
    function* () {
      yield* mockDirEntries
    }
  )

  const projectOpenStub = stub(
    Project,
    'open',
    () => Promise.resolve(mockProject)
  )

  try {
    const result = await SkmtcRoot.open(manager)

    // Should only have 1 project (filtered out @ prefixed)
    assertEquals(result.projects.length, 1)
    assertEquals(result.projects[0].name, 'valid-project')
  } finally {
    existsStub.restore()
    readDirStub.restore()
    projectOpenStub.restore()
  }
})
