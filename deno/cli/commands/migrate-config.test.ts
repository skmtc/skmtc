import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import { renderMigrateConfig } from '@/commands/migrate-config.ts'
import { captureConsole, withConfigRoot } from '@/tests/config-files.mock.ts'
import { withFakeTty } from '@/tests/strict-mode-helpers.test.ts'

/** A config on the old names, with keys before and after `system`. */
const legacyConfig = {
  source: './openapi.json',
  settings: {
    basePath: 'src/api',
    system: { allOf: 'latestWins', danglingRefs: ['schema'] },
    skip: [],
    enrichments: {}
  },
  project: '@acme/pets'
}

/** {@link legacyConfig} on the new names: `parse` in the place of `system`. */
const migratedText = JSON.stringify(
  {
    source: './openapi.json',
    settings: {
      basePath: 'src/api',
      parse: { allOf: 'latestWins', danglingRefs: ['schema'] },
      skip: [],
      enrichments: {}
    },
    project: '@acme/pets'
  },
  null,
  2
)

/** An `ask` that fails the test when it is called. */
const neverAsked = (message: string): boolean => {
  throw new Error(`asked: ${message}`)
}

Deno.test('migrate config - client.json with system becomes skmtc.config.json with parse, other keys and order kept', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile, settingsPath }) => {
    const { value: result } = await captureConsole(() =>
      renderMigrateConfig({ projectName: 'pets', mode: 'strict', ask: neverAsked })
    )

    assertEquals(result.exitCode, 0)
    assertEquals(readFile('pets', 'skmtc.config.json'), migratedText)
    assertEquals(readFile('pets', 'client.json'), undefined)
    assertEquals(result.projects, [
      {
        project: 'pets',
        configPath: {
          before: join(settingsPath('pets'), 'client.json'),
          after: join(settingsPath('pets'), 'skmtc.config.json')
        },
        renamedFile: true,
        movedKeys: ['allOf', 'danglingRefs'],
        conflicts: [],
        alreadyMigrated: false,
        dryRun: false,
        refused: undefined
      }
    ])
  })
})

Deno.test('migrate config - an already migrated project is not changed, exit 0', async () => {
  const migrated = JSON.parse(migratedText)

  await withConfigRoot({ pets: { 'skmtc.config.json': migrated } }, async ({ readFile }) => {
    const before = readFile('pets', 'skmtc.config.json')
    const { value: result, stdout } = await captureConsole(() =>
      renderMigrateConfig({ projectName: 'pets', mode: 'interactive', ask: neverAsked })
    )

    assertEquals(result.exitCode, 0)
    assertEquals(result.projects[0].alreadyMigrated, true)
    assertEquals(readFile('pets', 'skmtc.config.json'), before)
    assertStringIncludes(stdout.join('\n'), 'No changes needed')
  })
})

Deno.test('migrate config - a project with both files is not changed, exit 1, and both files are named', async () => {
  const files = { 'client.json': legacyConfig, 'skmtc.config.json': JSON.parse(migratedText) }

  await withConfigRoot({ pets: files }, async ({ readFile, settingsPath }) => {
    const legacyBefore = readFile('pets', 'client.json')
    const configBefore = readFile('pets', 'skmtc.config.json')
    const { value: result, stderr } = await captureConsole(() =>
      renderMigrateConfig({ projectName: 'pets', mode: 'strict', ask: neverAsked })
    )

    assertEquals(result.exitCode, 1)
    assertEquals(readFile('pets', 'client.json'), legacyBefore)
    assertEquals(readFile('pets', 'skmtc.config.json'), configBefore)
    assertStringIncludes(stderr.join('\n'), join(settingsPath('pets'), 'client.json'))
    assertStringIncludes(stderr.join('\n'), join(settingsPath('pets'), 'skmtc.config.json'))
  })
})

Deno.test('migrate config - with system and parse, parse is kept and a key with another value is a conflict', async () => {
  const config = {
    settings: {
      basePath: 'src',
      system: { allOf: 'latestWins', not: 'unknown' },
      parse: { allOf: 'strict', not: 'unknown' }
    }
  }

  await withConfigRoot({ pets: { 'skmtc.config.json': config } }, async ({ readFile }) => {
    const { value: result } = await captureConsole(() =>
      renderMigrateConfig({ projectName: 'pets', mode: 'strict', ask: neverAsked })
    )

    assertEquals(result.exitCode, 0)
    assertEquals(result.projects[0].conflicts, ['allOf'])
    assertEquals(result.projects[0].movedKeys, [])
    assertEquals(
      readFile('pets', 'skmtc.config.json'),
      JSON.stringify({ settings: { basePath: 'src', parse: { allOf: 'strict', not: 'unknown' } } }, null, 2)
    )
  })
})

Deno.test('migrate config - --dry-run reports the change and writes nothing', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile }) => {
    const before = readFile('pets', 'client.json')
    const { value: result, stdout } = await captureConsole(() =>
      renderMigrateConfig({ projectName: 'pets', dryRun: true, mode: 'interactive', ask: neverAsked })
    )

    assertEquals(result.exitCode, 0)
    assertEquals(result.projects[0].dryRun, true)
    assertEquals(result.projects[0].renamedFile, true)
    assertEquals(readFile('pets', 'client.json'), before)
    assertEquals(readFile('pets', 'skmtc.config.json'), undefined)
    assertStringIncludes(stdout.join('\n'), 'would rename')
  })
})

Deno.test('migrate config - --json prints one JSON result of the documented shape and never prompts', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile, settingsPath }) => {
    // A TTY, so only `--json` keeps the prompt away.
    let stdout: string[] = []
    await withFakeTty(async () => {
      stdout = (await captureConsole(() => renderMigrateConfig({ projectName: 'pets', jsonFlag: true, ask: neverAsked })))
        .stdout
    })

    assertEquals(stdout.length, 1)
    assertEquals(JSON.parse(stdout[0]), {
      projects: [
        {
          project: 'pets',
          configPath: {
            before: join(settingsPath('pets'), 'client.json'),
            after: join(settingsPath('pets'), 'skmtc.config.json')
          },
          renamedFile: true,
          movedKeys: ['allOf', 'danglingRefs'],
          conflicts: [],
          alreadyMigrated: false,
          dryRun: false
        }
      ]
    })
    assertEquals(readFile('pets', 'skmtc.config.json'), migratedText)
  })
})

Deno.test('migrate config - strict or agent mode without --force applies the change without a prompt', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile }) => {
    // A TTY, so only `--no-input` keeps the prompt away.
    await withFakeTty(async () => {
      await captureConsole(() => renderMigrateConfig({ projectName: 'pets', noInputFlag: true, ask: neverAsked }))
    })

    assertEquals(readFile('pets', 'skmtc.config.json'), migratedText)
  })
})

Deno.test('migrate config - interactive mode asks once, and a no writes nothing', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig }, shop: { 'client.json': legacyConfig } }, async ({ readFile }) => {
    const questions: string[] = []
    const { value: result, stdout } = await captureConsole(() =>
      renderMigrateConfig({
        mode: 'interactive',
        ask: message => {
          questions.push(message)
          return false
        }
      })
    )

    assertEquals(questions, ['Migrate these 2 projects?'])
    assertEquals(stdout.at(-1), 'Nothing was changed.')
    assertEquals(result.projects.map(project => project.dryRun), [true, true])
    assertEquals(readFile('pets', 'skmtc.config.json'), undefined)
    assertEquals(readFile('shop', 'skmtc.config.json'), undefined)
  })
})

Deno.test('migrate config - interactive mode with --force applies without a prompt', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile }) => {
    await captureConsole(() =>
      renderMigrateConfig({ projectName: 'pets', force: true, mode: 'interactive', ask: neverAsked })
    )

    assertEquals(readFile('pets', 'skmtc.config.json'), migratedText)
  })
})

Deno.test('migrate config - without a project name, every project is migrated', async () => {
  const projects = {
    pets: { 'client.json': legacyConfig },
    shop: { 'skmtc.config.json': legacyConfig },
    done: { 'skmtc.config.json': JSON.parse(migratedText) }
  }

  await withConfigRoot(projects, async ({ readFile }) => {
    const { value: result } = await captureConsole(() => renderMigrateConfig({ mode: 'strict', ask: neverAsked }))

    assertEquals(result.exitCode, 0)
    assertEquals(
      result.projects.map(({ project, alreadyMigrated }) => ({ project, alreadyMigrated })),
      [
        { project: 'done', alreadyMigrated: true },
        { project: 'pets', alreadyMigrated: false },
        { project: 'shop', alreadyMigrated: false }
      ]
    )
    assertEquals(readFile('pets', 'skmtc.config.json'), migratedText)
    assertEquals(readFile('shop', 'skmtc.config.json'), migratedText)
    assertEquals(readFile('done', 'skmtc.config.json'), migratedText)
  })
})
