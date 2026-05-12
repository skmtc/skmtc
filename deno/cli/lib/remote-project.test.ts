import { assertEquals } from '@std/assert/equals'
import { assertExists } from '@std/assert/exists'
import { assert } from '@std/assert/assert'
import { RemoteProject } from '@/lib/remote-project.ts'
import { SchemaFile } from '@/lib/schema-file.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { join } from '@std/path/join'

Deno.test('RemoteProject - fromKey parses project key correctly', async () => {
  const manager = createMockManager()
  const projectKey = '@testuser/my-project' as const
  const schemaFile = SchemaFile.create()

  const tempDir = await Deno.makeTempDir()
  try {
    // Create the required directory structure and files
    const projectPath = join(tempDir, '.skmtc', 'testuser', 'my-project', '.settings')
    await Deno.mkdir(projectPath, { recursive: true })
    await Deno.writeTextFile(join(projectPath, 'client.json'), '{}')

    // Mock toRemoteProjectPath to return our temp directory
    const originalCwd = Deno.cwd()
    Deno.chdir(tempDir)
    const project = await RemoteProject.fromKey({ projectKey, schemaFile, manager })

    assertEquals(project.accountName, 'testuser')
    assertEquals(project.name, 'my-project')
    assertExists(project.schemaFile)

    Deno.chdir(originalCwd)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('RemoteProject - toProjectKey returns formatted key with @ prefix', async () => {
  const manager = createMockManager()
  const projectKey = '@johndoe/example-app' as const
  const schemaFile = SchemaFile.create()

  const tempDir = await Deno.makeTempDir()

  try {
    const projectPath = join(tempDir, '.skmtc', 'johndoe', 'example-app', '.settings')
    await Deno.mkdir(projectPath, { recursive: true })
    await Deno.writeTextFile(join(projectPath, 'client.json'), '{}')

    const originalCwd = Deno.cwd()
    Deno.chdir(tempDir)

    const project = await RemoteProject.fromKey({ projectKey, schemaFile, manager })

    assertEquals(project.toProjectKey(), '@johndoe/example-app')

    Deno.chdir(originalCwd)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('RemoteProject - toManifestPath generates correct path', async () => {
  const manager = createMockManager()
  const projectKey = '@myuser/myproject' as const
  const schemaFile = SchemaFile.create()

  const tempDir = await Deno.makeTempDir()

  try {
    const projectPath = join(tempDir, '.skmtc', 'myuser', 'myproject', '.settings')
    await Deno.mkdir(projectPath, { recursive: true })
    await Deno.writeTextFile(join(projectPath, 'client.json'), '{}')

    const originalCwd = Deno.cwd()
    Deno.chdir(tempDir)

    const project = await RemoteProject.fromKey({ projectKey, schemaFile, manager })
    const manifestPath = project.toManifestPath()

    assert(manifestPath.includes('@myuser'))
    assertEquals(manifestPath.includes('myproject'), true)
    assertEquals(manifestPath.includes('.settings'), true)
    assertEquals(manifestPath.endsWith('manifest.json'), true)

    Deno.chdir(originalCwd)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('RemoteProject - handles hyphenated names', async () => {
  const manager = createMockManager()
  const projectKey = '@test-user/my-complex-app' as const
  const schemaFile = SchemaFile.create()

  const tempDir = await Deno.makeTempDir()

  try {
    const projectPath = join(tempDir, '.skmtc', 'test-user', 'my-complex-app', '.settings')
    await Deno.mkdir(projectPath, { recursive: true })
    await Deno.writeTextFile(join(projectPath, 'client.json'), '{}')

    const originalCwd = Deno.cwd()
    Deno.chdir(tempDir)

    const project = await RemoteProject.fromKey({ projectKey, schemaFile, manager })

    assertEquals(project.accountName, 'test-user')
    assertEquals(project.name, 'my-complex-app')
    assertEquals(project.toProjectKey(), '@test-user/my-complex-app')

    Deno.chdir(originalCwd)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
