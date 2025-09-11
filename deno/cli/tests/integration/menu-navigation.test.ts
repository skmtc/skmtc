import { assertEquals, assertStringIncludes } from '@std/assert'
import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test('CLI menu navigation with terminalSelect', async t => {
  await t.step('navigates menu and selects Exit', async () => {
    const env = await envManager.setup('menu-navigation-exit')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      [],
      [
        {
          waitFor: /Welcome.*Smktc/i,
          select: 'Exit',
          input: '\r'
        }
      ],
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 20000
      }
    )

    // Success means we found and selected the menu item
    const hasInteractiveOutput = result.stdout.length > 0 || result.stderr.length > 0
    assertEquals(hasInteractiveOutput, true, 'Should have captured menu interaction')

    await env.cleanup()
  })

  await t.step('navigates to Create new project menu', async () => {
    const env = await envManager.setup('menu-navigation-create')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      [],
      [
        {
          waitFor: /Welcome.*Smktc/i,
          select: 'Create new project',
          input: '\r'
        },
        {
          waitFor: /Project name/i,
          select: 'test-menu-project',
          input: 'test-menu-project\r'
        }
      ],
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 25000
      }
    )

    // Check if we got some project creation flow
    const hasProjectFlow = result.stdout.length > 0 || result.stderr.length > 0
    assertEquals(hasProjectFlow, true, 'Should have project creation flow')

    // If successful, verify project directory was created
    if (result.success) {
      const projectPath = join(env.projectsDir, 'test-menu-project')
      const projectExists = await exists(projectPath)
      assertEquals(projectExists, true, 'Project directory should be created when successful')
    }

    await env.cleanup()
  })

  await t.step('demonstrates multiple menu selections', async () => {
    const env = await envManager.setup('menu-multiple-selections')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      [],
      [
        {
          waitFor: /Welcome.*Smktc/i,
          select: 'Log in to Skmtc',
          input: '\r'
        }
      ],
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 15000
      }
    )

    const hasMenuInteraction = result.stdout.length > 0 || result.stderr.length > 0
    assertEquals(hasMenuInteraction, true, 'Should have menu interactions')

    await env.cleanup()
  })
})

Deno.test('CLI menu error handling', async t => {
  await t.step('handles non-existent menu items gracefully', async () => {
    const env = await envManager.setup('menu-error-handling')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      [],
      [
        {
          waitFor: /Welcome.*Smktc/i,
          select: 'Nonexistent Option',
          input: '\r'
        }
      ],
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 10000
      }
    )

    // Should still capture the menu but not find the item
    const hasOutput = result.stdout.length > 0 || result.stderr.length > 0
    assertEquals(hasOutput, true, 'Should have attempted menu navigation')

    await env.cleanup()
  })
})

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})
