import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { assert } from '@std/assert'
import { join } from '@std/path/join'
import { homedir } from 'node:os'
import { ensureDir } from '@std/fs/ensure-dir'
import { runAgentContext } from '@/lib/agent-context-headless.ts'
import { printAgentContext } from '@/commands/agent-context.ts'
import { captureStdout } from '@/tests/strict-mode-helpers.test.ts'

/**
 * Same fixture pattern as `doctor-headless.test.ts`: cd into a temp
 * dir inside $HOME (so `toRootPath` will pick it up) and build a
 * `.skmtc/<project>/` skeleton.
 */
const withTempSkmtcRoot = async (fn: (tempRoot: string) => Promise<void>): Promise<void> => {
  const tempRoot = await Deno.makeTempDir({ dir: homedir(), prefix: 'agent-ctx-test-' })
  await ensureDir(join(tempRoot, '.skmtc'))
  const originalCwd = Deno.cwd()
  Deno.chdir(tempRoot)
  try {
    await fn(tempRoot)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempRoot, { recursive: true })
  }
}

Deno.test('runAgentContext - empty root returns no projects', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const ctx = runAgentContext({ cliVersion: '0.1.5' })
    assertEquals(ctx.projects, [])
    assertEquals(ctx.cliVersion, '0.1.5')
    assertEquals(ctx.skmtcRootPath, join(tempRoot, '.skmtc'))
    // Commands list is hand-maintained; check that the canonical
    // agent-friendly commands appear, plus the new introspection
    // pair.
    const names = ctx.commands.map(c => c.name)
    assert(names.includes('list'))
    assert(names.includes('install'))
    assert(names.includes('generate'))
    assert(names.includes('doctor'))
    assert(names.includes('agent-context'))
  })
})

Deno.test("runAgentContext - snapshots a project's basePath, schemaSource and generators", async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'demo')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@^0.0.45',
          '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@^0.0.48',
          '@scope/gen-local': './gen-local/mod.ts',
          // Non-generator imports are filtered out.
          '@std/path': 'jsr:@std/path@^1.1.2'
        }
      })
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({
        source: 'https://example.com/schema.json',
        settings: { basePath: './src' }
      })
    )

    const ctx = runAgentContext({ cliVersion: '0.1.5' })
    assertEquals(ctx.projects.length, 1)
    const project = ctx.projects[0]
    assertEquals(project.name, 'demo')
    assertEquals(project.basePath, './src')
    assertEquals(project.schemaSource, 'https://example.com/schema.json')
    assertEquals(project.generators.remote, ['@skmtc/gen-typescript', '@skmtc/gen-zod'])
    assertEquals(project.generators.local, ['@scope/gen-local'])
  })
})

Deno.test('runAgentContext - missing client.json reports null basePath and schemaSource', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'bare')
    await ensureDir(projectPath)
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ imports: {} }))

    const ctx = runAgentContext({ cliVersion: '0.1.5' })
    assertEquals(ctx.projects[0].basePath, null)
    assertEquals(ctx.projects[0].schemaSource, null)
  })
})

Deno.test("runAgentContext - malformed deno.json yields empty generator lists, doesn't throw", async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'broken')
    await ensureDir(projectPath)
    await Deno.writeTextFile(join(projectPath, 'deno.json'), '{not json')

    // Should NOT throw — agent-context is a passive snapshot, not
    // a validator. Doctor's job is to flag broken state.
    const ctx = runAgentContext({ cliVersion: '0.1.5' })
    assertEquals(ctx.projects[0].generators.remote, [])
    assertEquals(ctx.projects[0].generators.local, [])
  })
})

Deno.test('runAgentContext - reports JSR_URL when env var is set', async () => {
  const originalJsrUrl = Deno.env.get('JSR_URL')
  Deno.env.set('JSR_URL', 'https://jsr.example.dev/')
  try {
    await withTempSkmtcRoot(async () => {
      const ctx = runAgentContext({ cliVersion: '0.1.5' })
      assertEquals(ctx.jsrUrl, 'https://jsr.example.dev/')
    })
  } finally {
    if (originalJsrUrl === undefined) {
      Deno.env.delete('JSR_URL')
    } else {
      Deno.env.set('JSR_URL', originalJsrUrl)
    }
  }
})

Deno.test('runAgentContext - command list documents agent-mode classification', async () => {
  await withTempSkmtcRoot(async () => {
    const ctx = runAgentContext({ cliVersion: '0.1.5' })
    const list = ctx.commands.find(c => c.name === 'list')
    assertEquals(list?.agentMode, 'full')

    const create = ctx.commands.find(c => c.name === 'create')
    assertEquals(create?.agentMode, 'none')

    const doctor = ctx.commands.find(c => c.name === 'doctor')
    assertEquals(doctor?.agentMode, 'json-only')
  })
})

Deno.test('printAgentContext - json format is parseable and complete', async () => {
  const logs = await captureStdout(async () => {
    printAgentContext(
      {
        cliVersion: '0.1.5',
        skmtcRootPath: '/sk',
        globalStateDir: '/h/.skmtc',
        jsrUrl: 'https://jsr.io/',
        projects: [],
        commands: [
          {
            name: 'list',
            description: 'List generators',
            args: ['[project]'],
            flags: [{ flag: '--json', description: 'JSON output.' }],
            agentMode: 'full'
          }
        ]
      },
      { format: 'json' }
    )
  })
  assertEquals(logs.length, 1)
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.cliVersion, '0.1.5')
  assertEquals(parsed.commands.length, 1)
  assertEquals(parsed.commands[0].name, 'list')
})

Deno.test('printAgentContext - text format shows commands with flags', async () => {
  const logs = await captureStdout(async () => {
    printAgentContext(
      {
        cliVersion: '0.1.5',
        skmtcRootPath: '/sk',
        globalStateDir: '/h/.skmtc',
        jsrUrl: 'https://jsr.io/',
        projects: [
          {
            name: 'demo',
            basePath: './src',
            schemaSource: null,
            generators: { remote: ['@skmtc/gen-zod'], local: [] }
          }
        ],
        commands: [
          {
            name: 'list',
            description: 'List generators',
            args: ['[project]'],
            flags: [{ flag: '--json', description: 'JSON' }],
            agentMode: 'full'
          }
        ]
      },
      { format: 'text' }
    )
  })
  const joined = logs.join('\n')
  assertStringIncludes(joined, 'CLI 0.1.5')
  assertStringIncludes(joined, 'demo')
  assertStringIncludes(joined, '@skmtc/gen-zod')
  assertStringIncludes(joined, 'skmtc list [project]')
  assertStringIncludes(joined, 'agent-mode: full')
})
