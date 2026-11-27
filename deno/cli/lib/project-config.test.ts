import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import {
  printJsonResult,
  reportConfigDeprecations,
  toConfigLocation,
  toMovedSettings
} from '@/lib/project-config.ts'
import { runAgentContext } from '@/lib/agent-context-headless.ts'
import { printAgentContext } from '@/commands/agent-context.ts'
import { checkProjectConfigNames, runDoctor } from '@/lib/doctor-headless.ts'
import { printDoctorResult } from '@/commands/doctor.ts'
import { migrateVariantsHeadless } from '@/lib/migrate-variants-headless.ts'
import { Project } from '@/lib/project.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { captureConsole, withConfigRoot } from '@/tests/config-files.mock.ts'

const legacyConfig = { settings: { basePath: 'src', system: { not: 'unknown' } } }
const currentConfig = { settings: { basePath: 'src', parse: { not: 'unknown' } } }

Deno.test('toConfigLocation - skmtc.config.json, else client.json, else skmtc.config.json to create', async () => {
  const projects = {
    current: { 'skmtc.config.json': currentConfig },
    legacy: { 'client.json': legacyConfig },
    both: { 'skmtc.config.json': currentConfig, 'client.json': legacyConfig },
    none: {}
  }

  await withConfigRoot(projects, ({ tempRoot, settingsPath }) => {
    const at = (name: string) => toConfigLocation(join(tempRoot, '.skmtc', name))

    assertEquals(at('current'), {
      path: join(settingsPath('current'), 'skmtc.config.json'),
      legacy: false,
      ignoredLegacyPath: undefined
    })
    assertEquals(at('legacy'), {
      path: join(settingsPath('legacy'), 'client.json'),
      legacy: true,
      ignoredLegacyPath: undefined
    })
    assertEquals(at('both'), {
      path: join(settingsPath('both'), 'skmtc.config.json'),
      legacy: false,
      ignoredLegacyPath: join(settingsPath('both'), 'client.json')
    })
    assertEquals(at('none').path, join(settingsPath('none'), 'skmtc.config.json'))
  })
})

Deno.test('toMovedSettings - system moves to parse in its place; beside parse it goes, with conflicts', () => {
  const moved = toMovedSettings({ basePath: 'src', system: { not: 'unknown' }, skip: [] })

  assertEquals(Object.keys(moved.settings), ['basePath', 'parse', 'skip'])
  assertEquals(moved.settings.parse, { not: 'unknown' })
  assertEquals(moved.movedKeys, ['not'])

  const beside = toMovedSettings({
    system: { not: 'unknown', allOf: 'strict' },
    parse: { not: 'strict', allOf: 'strict' }
  })

  assertEquals(beside.settings, { parse: { not: 'strict', allOf: 'strict' } })
  assertEquals(beside.conflicts, ['not'])

  // The same `danglingRefs` in another order is not a conflict.
  const reordered = toMovedSettings({
    system: { danglingRefs: ['schema', 'parameter'] },
    parse: { danglingRefs: ['parameter', 'schema'] }
  })
  assertEquals(reordered.conflicts, [])
})

Deno.test('reportConfigDeprecations - one warning per old name per run, on stderr; stdout stays clean', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ tempRoot }) => {
    const projectPath = join(tempRoot, '.skmtc', 'pets')
    const location = toConfigLocation(projectPath)

    const { stdout, stderr } = await captureConsole(() => {
      reportConfigDeprecations({ projectPath, location, config: legacyConfig })
      reportConfigDeprecations({ projectPath, location, config: legacyConfig })
    })

    assertEquals(stdout, [])
    assertEquals(stderr.length, 2)
    assertStringIncludes(stderr[0], 'client.json')
    assertStringIncludes(stderr[0], 'skmtc.config.json')
    assertStringIncludes(stderr[0], 'skmtc migrate config pets')
    assertStringIncludes(stderr[1], 'settings.system')
    assertStringIncludes(stderr[1], 'settings.parse')
    assertStringIncludes(stderr[1], 'skmtc migrate config pets')

    // A JSON result carries them in `deprecations`.
    const { stdout: json } = await captureConsole(() => printJsonResult({ ok: true }))
    assertEquals(json.length, 1)
    assertEquals(JSON.parse(json[0]), {
      ok: true,
      deprecations: [
        { kind: 'configFile', old: 'client.json', new: 'skmtc.config.json', fix: 'skmtc migrate config pets' },
        { kind: 'settingsKey', old: 'settings.system', new: 'settings.parse', fix: 'skmtc migrate config pets' }
      ]
    })
  })
})

Deno.test('reportConfigDeprecations - with parse and system, says system is ignored and names the keys that differ', async () => {
  const config = { settings: { parse: { allOf: 'strict', not: 'unknown' }, system: { allOf: 'latestWins', not: 'unknown' } } }

  await withConfigRoot({ pets: { 'skmtc.config.json': config } }, async ({ tempRoot }) => {
    const projectPath = join(tempRoot, '.skmtc', 'pets')
    const { stderr } = await captureConsole(() => {
      reportConfigDeprecations({ projectPath, location: toConfigLocation(projectPath), config })
      reportConfigDeprecations({ projectPath, location: toConfigLocation(projectPath), config })
    })

    const both = stderr.filter(line => line.includes('settings.system is ignored'))
    assertEquals(both.length, 1)
    assertStringIncludes(both[0], 'settings.system has another value for: allOf.')
  })
})

Deno.test('Project.open - a project on the new names prints no warning, and its JSON result has no deprecations', async () => {
  await withConfigRoot({ pets: { 'skmtc.config.json': currentConfig } }, async () => {
    const { stderr } = await captureConsole(() => Project.open('pets', createMockManager()))
    const { stdout } = await captureConsole(() => printJsonResult({ ok: true }))

    assertEquals(stderr, [])
    assertEquals(JSON.parse(stdout[0]), { ok: true })
  })
})

Deno.test('a command that writes config writes the file it read: skmtc migrate variants on each name', async () => {
  for (const fileName of ['client.json', 'skmtc.config.json'] as const) {
    const config = { settings: { system: { not: 'unknown' }, skip: [{ 'gen-a': { '/pets': ['get'] } }] } }

    await withConfigRoot({ pets: { [fileName]: config } }, async ({ readFile }) => {
      const result = await migrateVariantsHeadless({ projectName: 'pets' })
      const other = fileName === 'client.json' ? 'skmtc.config.json' : 'client.json'

      assertEquals(result.alreadyMigrated, false)
      assertEquals(readFile('pets', other), undefined)
      // It writes `parse`, never `system`, and leaves the file name alone.
      assertEquals(JSON.parse(readFile('pets', fileName) ?? '{}'), {
        settings: { parse: { not: 'unknown' }, skip: [{ 'gen-a': { '/pets': { get: [] } } }] }
      })
    })
  }
})

Deno.test('a command that writes config writes the file it read: Project.open cleanup on each name', async () => {
  for (const fileName of ['client.json', 'skmtc.config.json'] as const) {
    await withConfigRoot({ pets: { [fileName]: legacyConfig } }, async ({ readFile }) => {
      const manager = createMockManager()
      await captureConsole(async () => {
        const project = await Project.open('pets', manager)
        // A command that changes the config, as `pull -u` records a destination.
        project.clientJson.updateContents({ project: '@acme/pets' })
        await Promise.all(manager.cleanupActions.map(action => action()))
      })
      const other = fileName === 'client.json' ? 'skmtc.config.json' : 'client.json'

      assertEquals(readFile('pets', other), undefined)
      assertEquals(JSON.parse(readFile('pets', fileName) ?? '{}'), { ...currentConfig, project: '@acme/pets' })
    })
  }
})

Deno.test('a command that only reads config leaves the file as it is, with settings.system', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile }) => {
    const before = readFile('pets', 'client.json')
    const manager = createMockManager()
    await captureConsole(async () => {
      await Project.open('pets', manager)
      await Promise.all(manager.cleanupActions.map(action => action()))
    })

    assertEquals(readFile('pets', 'client.json'), before)
  })
})

Deno.test('doctor - lists the deprecations, in text and with --json', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig }, shop: { 'skmtc.config.json': currentConfig } }, async () => {
    const result = await runDoctor({
      cliVersion: '0.0.0',
      offline: true,
      checkModuleGraph: () => Promise.resolve({ type: 'unavailable', reason: 'not resolved in tests' })
    })

    const { stdout: json } = await captureConsole(() => printDoctorResult(result, { format: 'json' }))
    const parsed = JSON.parse(json[0])
    assertEquals(parsed.deprecations, [
      { kind: 'configFile', old: 'client.json', new: 'skmtc.config.json', fix: 'skmtc migrate config pets' },
      { kind: 'settingsKey', old: 'settings.system', new: 'settings.parse', fix: 'skmtc migrate config pets' }
    ])

    const { stdout: text } = await captureConsole(() => printDoctorResult(result, { format: 'text' }))
    assertStringIncludes(text.join('\n'), 'config-names/pets')
    assertStringIncludes(text.join('\n'), 'skmtc migrate config pets')
  })
})

Deno.test('doctor - with both files, the check also names settings.system in the file it reads', async () => {
  const files = { 'skmtc.config.json': legacyConfig, 'client.json': legacyConfig }

  await withConfigRoot({ pets: files }, ({ tempRoot }) => {
    const check = checkProjectConfigNames('pets', join(tempRoot, '.skmtc', 'pets'))

    assertEquals(check.status, 'warning')
    assertStringIncludes(check.message, 'has both skmtc.config.json and client.json')
    assertStringIncludes(check.message, 'settings.system (now settings.parse)')
  })
})

Deno.test('agent-context - lists the deprecations, in text and with --json', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig }, shop: { 'skmtc.config.json': currentConfig } }, async () => {
    const context = runAgentContext({ cliVersion: '0.0.0' })

    const { stdout: json } = await captureConsole(() => printAgentContext(context, { format: 'json' }))
    assertEquals(JSON.parse(json[0]).deprecations, [
      { kind: 'configFile', old: 'client.json', new: 'skmtc.config.json', fix: 'skmtc migrate config pets' },
      { kind: 'settingsKey', old: 'settings.system', new: 'settings.parse', fix: 'skmtc migrate config pets' }
    ])

    const { stdout: text } = await captureConsole(() => printAgentContext(context, { format: 'text' }))
    assertStringIncludes(text.join('\n'), 'settings.system → settings.parse   fix: skmtc migrate config pets')
    // The new command is listed for agents.
    assertEquals(context.commands.some(command => command.name === 'migrate config'), true)
  })
})
