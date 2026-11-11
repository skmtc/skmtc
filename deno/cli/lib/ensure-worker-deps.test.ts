import { assertEquals, assertRejects } from '@std/assert'
import { join } from '@std/path/join'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import { ensureWorkerDeps } from '@/lib/ensure-worker-deps.ts'
import { readCliCorePin } from '@/lib/doctor-headless.ts'
import { toWorkerModule } from '@/lib/stack-core.ts'

const toDenoJson = (imports: Record<string, string>): RootDenoJson => {
  const denoJson = RootDenoJson.create('test')
  Object.entries(imports).forEach(([key, value]) => denoJson.addImport(key, value))
  return denoJson
}

/** A temp folder holding `files`, removed after `fn`. Paths in `fn` are absolute. */
const withFolder = async (files: Record<string, string>, fn: (folder: string) => Promise<void>) => {
  const folder = await Deno.makeTempDir({ prefix: 'ensure-worker-deps-' })
  try {
    for (const [path, content] of Object.entries(files)) {
      await Deno.mkdir(join(folder, path, '..'), { recursive: true })
      await Deno.writeTextFile(join(folder, path), content)
    }
    await fn(folder)
  } finally {
    await Deno.remove(folder, { recursive: true })
  }
}

Deno.test('ensureWorkerDeps', async t => {
  await t.step('pins the CLI core only when no generator names a core', async () => {
    const denoJson = RootDenoJson.create('test')

    const changed = await ensureWorkerDeps(denoJson)

    assertEquals(changed, true)
    assertEquals(denoJson.contents.imports?.['@skmtc/core'], `jsr:@skmtc/core@${readCliCorePin()}`)
  })

  await t.step('with no pin, takes the core the installed generators need, not the CLI one', async () => {
    // A generator on core 0.38 and no core pin (an older CLI's TUI install,
    // or a hand edit): pinning the CLI core would bundle two cores.
    await withFolder(
      { 'gen-local/deno.json': JSON.stringify({ imports: { '@skmtc/core': 'jsr:@skmtc/core@0.38.0' } }) },
      async folder => {
        const denoJson = toDenoJson({ '@skmtc/gen-local': join(folder, 'gen-local', 'mod.ts') })

        await ensureWorkerDeps(denoJson)

        assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.38.0')
        assertEquals(denoJson.contents.imports?.['@skmtc/worker'], 'jsr:@skmtc/worker@0.3.74')
      }
    )
  })

  await t.step('a core with the worker entry needs no @skmtc/worker pin', async () => {
    const denoJson = toDenoJson({ '@skmtc/core': 'jsr:@skmtc/core@0.39.0' })

    const changed = await ensureWorkerDeps(denoJson)

    assertEquals(changed, false)
    assertEquals(toWorkerModule(denoJson.contents.imports), '@skmtc/core/worker')
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], undefined)
  })

  await t.step('an older stack gets the worker built on its own core', async () => {
    const denoJson = toDenoJson({ '@skmtc/core': 'jsr:@skmtc/core@0.37.0' })

    const changed = await ensureWorkerDeps(denoJson)

    assertEquals(changed, true)
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], 'jsr:@skmtc/worker@0.3.73')
  })

  await t.step('an older stack with no matching worker stops with the fix to apply', async () => {
    const denoJson = toDenoJson({ '@skmtc/core': 'jsr:@skmtc/core@0.30.0' })

    const error = await assertRejects(() => ensureWorkerDeps(denoJson))

    assertEquals(String(error).includes('@skmtc/core 0.30.0'), true)
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], undefined)
  })

  await t.step('a ranged core pin with no worker pin stops instead of guessing', async () => {
    // Deno resolves the range to the newest match, so no worker version is known to fit.
    const denoJson = toDenoJson({ '@skmtc/core': 'jsr:@skmtc/core@0.38' })

    await assertRejects(() => ensureWorkerDeps(denoJson), Error, 'Pin an exact version')
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], undefined)
  })

  await t.step('a core range that only matches cores with the worker entry needs no worker pin', async () => {
    const denoJson = toDenoJson({ '@skmtc/core': 'jsr:@skmtc/core@^0.39.0' })

    const changed = await ensureWorkerDeps(denoJson)

    assertEquals(changed, false)
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], undefined)
  })

  await t.step('a local core that exports ./worker gets the @skmtc/core/worker map entry', async () => {
    await withFolder(
      { 'core/deno.json': JSON.stringify({ name: '@skmtc/core', exports: { '.': './mod.ts', './worker': './worker/mod.ts' } }) },
      async folder => {
        const denoJson = toDenoJson({ '@skmtc/core': join(folder, 'core', 'mod.ts') })

        await ensureWorkerDeps(denoJson)

        assertEquals(denoJson.contents.imports?.['@skmtc/core/worker'], join(folder, 'core', 'worker', 'mod.ts'))
        assertEquals(toWorkerModule(denoJson.contents.imports), '@skmtc/core/worker')
        assertEquals(denoJson.contents.imports?.['@skmtc/worker'], undefined)
      }
    )
  })

  await t.step('a local core without ./worker keeps its local @skmtc/worker override', async () => {
    await withFolder(
      { 'core/deno.json': JSON.stringify({ name: '@skmtc/core', exports: { '.': './mod.ts' } }) },
      async folder => {
        const imports = { '@skmtc/core': join(folder, 'core', 'mod.ts'), '@skmtc/worker': '../../worker/mod.ts' }
        const denoJson = toDenoJson(imports)

        const changed = await ensureWorkerDeps(denoJson)

        assertEquals(changed, false)
        assertEquals(denoJson.contents.imports, imports)
        assertEquals(toWorkerModule(denoJson.contents.imports), '@skmtc/worker')
      }
    )
  })

  await t.step('never overwrites an existing pin (e.g. a local-checkout override)', async () => {
    const imports = { '@skmtc/worker': '../../worker/mod.ts', '@skmtc/core': 'jsr:@skmtc/core@0.0.1' }
    const denoJson = toDenoJson(imports)

    const changed = await ensureWorkerDeps(denoJson)

    assertEquals(changed, false)
    assertEquals(denoJson.contents.imports, imports)
  })
})
