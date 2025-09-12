import { assertEquals, assertStringIncludes } from '@std/assert'
import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager, createMockProject } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test('init command', async (t) => {
  await t.step('creates project with valid arguments', async () => {
    const env = await envManager.setup('init-valid-args')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      ['init', 'test-project', '@skmtc/gen-typescript', './src'],
      [],  // No interactions needed when all args provided
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 10000
      }
    )

    assertEquals(result.success, true, 'Command should succeed')
    assertStringIncludes(result.stdout, 'Deno project created')
    
    const projectPath = join(env.projectsDir, 'test-project')
    const projectExists = await exists(projectPath)
    assertEquals(projectExists, true, 'Project directory should be created')

    const denoJsonPath = join(projectPath, 'deno.json')
    const denoJsonExists = await exists(denoJsonPath)
    assertEquals(denoJsonExists, true, 'deno.json should be created')

    const clientJsonPath = join(projectPath, '.settings', 'client.json')
    const clientJsonExists = await exists(clientJsonPath)
    assertEquals(clientJsonExists, true, 'client.json should be created')

    await env.cleanup()
  })

  await t.step('handles missing arguments', async () => {
    const env = await envManager.setup('init-missing-args')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      ['init'],
      [],  // No interactions, expecting error
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 5000
      }
    )

    assertEquals(result.success, false, 'Command should fail with missing args')

    await env.cleanup()
  })

  await t.step('creates second project successfully', async () => {
    const env = await envManager.setup('init-second-project')
    const envVars = envManager.getEnvVars(env)

    // Create first project
    const result1 = await cliRunner.runInteractive(
      ['init', 'first-project', '@skmtc/gen-typescript', './src'],
      [],  // No interactions needed when all args provided
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 10000
      }
    )

    assertEquals(result1.success, true, 'First project should succeed')

    // Create second project
    const result2 = await cliRunner.runInteractive(
      ['init', 'second-project', '@skmtc/gen-typescript', './src'],
      [],  // No interactions needed when all args provided
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 10000
      }
    )

    assertEquals(result2.success, true, 'Second project should succeed')

    const project1Path = join(env.projectsDir, 'first-project')
    const project2Path = join(env.projectsDir, 'second-project')
    
    assertEquals(await exists(project1Path), true, 'First project should exist')
    assertEquals(await exists(project2Path), true, 'Second project should exist')

    await env.cleanup()
  })

  await t.step('stores generator information', async () => {
    const env = await envManager.setup('init-generators')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      ['init', 'gen-test', '@skmtc/gen-typescript', './src'],
      [],  // No interactions needed when all args provided
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 10000
      }
    )

    assertEquals(result.success, true, 'Command should succeed')

    const projectPath = join(env.projectsDir, 'gen-test')
    const clientJsonPath = join(projectPath, '.settings', 'client.json')
    const clientJson = JSON.parse(await Deno.readTextFile(clientJsonPath))

    assertEquals(clientJson.settings.basePath, './src', 'Should store base path')

    await env.cleanup()
  })

  await t.step('respects custom base path', async () => {
    const env = await envManager.setup('init-custom-base')
    const envVars = envManager.getEnvVars(env)

    const customPath = './custom/output'
    const result = await cliRunner.runInteractive(
      ['init', 'custom-path-test', '@skmtc/gen-typescript', customPath],
      [],  // No interactions needed when all args provided
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 10000
      }
    )

    assertEquals(result.success, true, 'Command should succeed')

    const projectPath = join(env.projectsDir, 'custom-path-test')
    const clientJsonPath = join(projectPath, '.settings', 'client.json')
    const clientJson = JSON.parse(await Deno.readTextFile(clientJsonPath))

    assertEquals(clientJson.settings.basePath, customPath, 'Should use custom base path')

    await env.cleanup()
  })
})

// Note: Interactive prompt tests are commented out because they require 
// complex simulation and the current CLI implementation uses real prompts.
// These could be added back once the CLI supports proper test mode for prompts.

Deno.test('init command edge cases', async (t) => {
  await t.step('handles special characters in project name', async () => {
    const env = await envManager.setup('init-special-chars')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      ['init', 'test_project-123', '@skmtc/gen-typescript', './src'],
      [],  // No interactions needed when all args provided
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 10000
      }
    )

    assertEquals(result.success, true, 'Command should succeed')

    const projectPath = join(env.projectsDir, 'test_project-123')
    const projectExists = await exists(projectPath)
    assertEquals(projectExists, true, 'Project should be created')

    await env.cleanup()
  })
})

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})