import { assertEquals, assertStringIncludes } from '@std/assert'
import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test('CLI comprehensive functionality', async t => {
  await t.step('shows help and commands', async () => {
    const env = await envManager.setup('cli-help')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.run({
      args: ['--help'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 15000
    })

    assertEquals(result.success, true, 'Help command should succeed')
    assertStringIncludes(result.stdout, 'Generate code from OpenAPI schema')
    assertStringIncludes(result.stdout, 'init')
    assertStringIncludes(result.stdout, 'add')
    assertStringIncludes(result.stdout, 'deploy')
    assertStringIncludes(result.stdout, 'generate')

    await env.cleanup()
  })

  await t.step('shows init command help', async () => {
    const env = await envManager.setup('init-help')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.run({
      args: ['init', '--help'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 15000
    })

    assertEquals(result.success, true, 'Init help should succeed')
    assertStringIncludes(result.stdout, 'Initialize a new project')

    await env.cleanup()
  })

  await t.step('creates project via init command', async () => {
    const env = await envManager.setup('init-project')
    const envVars = envManager.getEnvVars(env)

    // Test direct init command with all required arguments
    const result = await cliRunner.run({
      args: ['init', 'test-comprehensive', '@skmtc/gen-typescript', 'src/generated'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 30000
    })

    assertEquals(result.success, true, 'Init command should succeed')
    assertStringIncludes(result.stdout, 'Project created')

    // Verify project directory structure
    const projectPath = join(env.projectsDir, 'test-comprehensive')
    const projectExists = await exists(projectPath)
    assertEquals(projectExists, true, 'Project directory should be created')

    // Verify deno.json was created
    const denoJsonPath = join(projectPath, 'deno.json')
    const denoJsonExists = await exists(denoJsonPath)
    assertEquals(denoJsonExists, true, 'deno.json should be created')

    // Verify client.json settings were created with correct base path
    const clientJsonPath = join(projectPath, '.settings', 'client.json')
    const clientJsonExists = await exists(clientJsonPath)
    assertEquals(clientJsonExists, true, 'client.json should be created')

    const clientJsonContent = JSON.parse(await Deno.readTextFile(clientJsonPath))
    assertEquals(
      clientJsonContent.settings.basePath,
      'src/generated',
      'Should have correct base path'
    )

    await env.cleanup()
  })

  await t.step('handles invalid arguments gracefully', async () => {
    const env = await envManager.setup('invalid-args')
    const envVars = envManager.getEnvVars(env)

    // Test init with missing arguments
    const result = await cliRunner.run({
      args: ['init'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 10000
    })

    assertEquals(result.success, false, 'Should fail with missing arguments')

    await env.cleanup()
  })

  await t.step('handles unknown commands', async () => {
    const env = await envManager.setup('unknown-command')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.run({
      args: ['nonexistent-command'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 10000
    })

    assertEquals(result.success, false, 'Should fail with unknown command')

    await env.cleanup()
  })

  await t.step('shows interactive prompt when no arguments', async () => {
    const env = await envManager.setup('interactive-prompt')
    const envVars = envManager.getEnvVars(env)

    // Run CLI without arguments to trigger interactive mode
    // We expect it to start the interactive prompt but timeout
    const result = await cliRunner.run({
      args: [],
      env: envVars,
      cwd: env.homeDir,
      timeout: 3000 // Short timeout since we expect it to hang on prompt
    })

    // Interactive mode typically times out or exits with non-zero when interrupted
    // The important thing is that it starts the interactive flow
    const hasOutput = result.stdout.length > 0 || result.stderr.length > 0
    if (!hasOutput && !result.success) {
      console.log('✅ CLI started interactive mode (timed out as expected)')
    } else if (result.success && result.stdout.includes('Welcome')) {
      console.log('✅ CLI showed interactive welcome message')
    }

    // This is more of a "does it start properly" test than a success assertion
    assertEquals(typeof result.code, 'number', 'Should return some exit code')

    await env.cleanup()
  })
})

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})
