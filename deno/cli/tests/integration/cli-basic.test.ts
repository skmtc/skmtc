import { assertEquals, assertStringIncludes } from '@std/assert'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test('CLI basic functionality', async t => {
  await t.step('shows help when no arguments provided', async () => {
    const env = await envManager.setup('cli-help')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.run({
      args: ['--help'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 5000
    })

    console.log(result.stdout)

    assertEquals(result.success, true, 'Help command should succeed')
    assertStringIncludes(result.stdout, 'Generate code from OpenAPI schema')
    assertStringIncludes(result.stdout, 'init')
    assertStringIncludes(result.stdout, 'add')
    assertStringIncludes(result.stdout, 'deploy')

    await env.cleanup()
  })

  await t.step('shows init command help', async () => {
    const env = await envManager.setup('init-help')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.run({
      args: ['init', '--help'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 5000
    })

    assertEquals(result.success, true, 'Init help should succeed')
    assertStringIncludes(result.stdout, 'Initialize a new project')

    await env.cleanup()
  })

  await t.step('validates init command arguments', async () => {
    const env = await envManager.setup('init-validation')
    const envVars = envManager.getEnvVars(env)

    // Test with missing arguments
    const result = await cliRunner.run({
      args: ['init'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 5000
    })

    // Should either show error or help for missing arguments
    assertEquals(result.success, false, 'Should fail with missing arguments')

    await env.cleanup()
  })

  await t.step('handles unknown commands gracefully', async () => {
    const env = await envManager.setup('unknown-command')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.run({
      args: ['unknown-command'],
      env: envVars,
      cwd: env.homeDir,
      timeout: 5000
    })

    assertEquals(result.success, false, 'Should fail with unknown command')
    assertStringIncludes(
      result.stderr || result.stdout,
      'unknown',
      'Should mention unknown command'
    )

    await env.cleanup()
  })
})

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})
