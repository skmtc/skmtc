# Mocking External Dependencies for CLI Tests

The current SKMTC CLI makes several external API calls that need to be mocked for proper testing. This guide explains how to implement mocking for full integration testing.

## Current External Dependencies

1. **Supabase Authentication** - User login/logout
2. **Remote Project Creation** - `createApiServers` API call  
3. **JSR Package Registry** - Version checking and package fetching
4. **Deno KV** - Local key-value storage

## Required Code Modifications

To enable proper testing, the CLI needs to check for test mode and use mocks instead of real services.

### 1. Modify SkmtcRoot Constructor

```typescript
// In lib/skmtc-root.ts
export class SkmtcRoot {
  // ...existing code...
  
  async createDenoProject(serverName: string) {
    // Check for test mode
    if (Deno.env.get('SKMTC_TEST_MODE') === 'true') {
      // Return mock project instead of calling API
      return {
        id: 'test-project-id',
        serverName,
        latestDeploymentId: null,
        latestDenoDeploymentId: null,
        denoProjectName: serverName,
        latestStatus: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }
    
    // Original implementation
    const project = await createApiServers({
      supabase: this.manager.auth.supabase,
      body: { serverName }
    })
    return project
  }
}
```

### 2. Mock Authentication

```typescript
// In auth/auth.ts or manager.ts
export class Auth {
  constructor(manager: Manager) {
    if (Deno.env.get('SKMTC_TEST_MODE') === 'true') {
      this.supabase = new MockSupabaseClient()
    } else {
      this.supabase = createClient(/* real config */)
    }
  }
  
  async isLoggedIn(): Promise<boolean> {
    if (Deno.env.get('SKMTC_SKIP_AUTH') === 'true') {
      return false // or true, depending on test scenario
    }
    // Original implementation
  }
}
```

### 3. Mock JSR Registry Calls

```typescript
// In lib/jsr.ts
export class Jsr {
  static async getLatestMeta(params: { scopeName: string; packageName: string }) {
    if (Deno.env.get('SKMTC_TEST_MODE') === 'true') {
      return {
        latest: '0.0.1',
        versions: ['0.0.1'],
      }
    }
    // Original implementation
  }
}
```

### 4. Mock File System Operations

```typescript
// In lib/project.ts
export class Project {
  static async create({ name, basePath, generators, skmtcRoot }: CreateArgs) {
    const project = new Project({
      name,
      rootDenoJson: RootDenoJson.create(name),
      clientJson: ClientJson.create({
        path: ClientJson.toPath({ projectPath: toProjectPath(name) }),
        basePath
      }),
      prettierJson: PrettierJson.create({ path: PrettierJson.toPath(name), contents: {} }),
      manifest: await Manifest.open(name),
      manager: skmtcRoot.manager,
      schemaFile: SchemaFile.create()
    })

    // Skip network calls in test mode
    if (Deno.env.get('SKMTC_TEST_MODE') !== 'true') {
      const generatorIdSet = getDependencyIds({
        checkedIds: new Set(),
        options: availableGenerators,
        generatorIds: new Set(generators)
      })

      for (const generatorId of generatorIdSet) {
        await project.installGenerator({ moduleName: `jsr:${generatorId}` })
      }
    }

    await project.prettierJson?.write()
    await project.clientJson.write()
    await project.rootDenoJson.write()

    return project
  }
}
```

## Environment Variables for Testing

The test environment should set these variables:

```typescript
const testEnvVars = {
  SKMTC_TEST_MODE: 'true',           // Enable test mode
  SKMTC_SKIP_AUTH: 'true',           // Skip authentication
  SKMTC_SKIP_REMOTE_PROJECT: 'true', // Skip remote project creation
  SKMTC_OFFLINE_MODE: 'true',        // Skip network calls
  SKMTC_DISABLE_TELEMETRY: 'true',   // Skip telemetry
  NO_COLOR: '1',                     // Disable colored output
  FORCE_COLOR: '0',                  // Ensure no colors
}
```

## Test Implementation Strategy

1. **Unit Tests**: Test individual functions with mocked dependencies
2. **Integration Tests**: Test CLI commands with mocked external services
3. **E2E Tests**: Test full workflows in isolated environments

### Example Integration Test with Mocks

```typescript
Deno.test('init command with mocks', async (t) => {
  await t.step('creates project successfully', async () => {
    const env = await envManager.setup('init-mocked')
    const envVars = {
      ...envManager.getEnvVars(env),
      SKMTC_TEST_MODE: 'true',
      SKMTC_SKIP_REMOTE_PROJECT: 'true',
    }

    const result = await cliRunner.run({
      args: ['init', 'test-project', '@skmtc/gen-typescript', './src'],
      env: envVars,
      cwd: env.homeDir,
    })

    assertEquals(result.success, true)
    assertStringIncludes(result.stdout, 'Created new project folder')
    
    // Verify local files were created
    const projectPath = join(env.projectsDir, 'test-project')
    const projectExists = await exists(projectPath)
    assertEquals(projectExists, true)

    await env.cleanup()
  })
})
```

## Benefits of This Approach

1. **Fast Tests**: No network calls means tests run quickly
2. **Reliable**: Tests don't fail due to network issues
3. **Isolated**: Each test runs independently
4. **Comprehensive**: Can test error scenarios easily
5. **Deterministic**: Same results every time

## Implementation Priority

1. **High Priority**: Mock project creation and auth (enables init testing)
2. **Medium Priority**: Mock JSR calls (enables generator testing)
3. **Low Priority**: Mock telemetry and analytics

This approach allows testing the CLI's user interface and business logic while avoiding flaky network-dependent tests.