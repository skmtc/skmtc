import { assertEquals, assertRejects } from '@std/assert'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import { ensureWorkerDeps } from '@/lib/ensure-worker-deps.ts'
import { readCliCorePin, readCliWorkerPin } from '@/lib/doctor-headless.ts'
import { toWorkerModule } from '@/lib/stack-core.ts'
import cliDenoJson from '@/deno.json' with { type: 'json' }

/** Fails the test if the registry lookup runs when it should not. */
const noLookup = (): Promise<string | null> => {
  throw new Error('findWorkerVersion must not be called')
}

Deno.test('ensureWorkerDeps', async t => {
  await t.step('pins the CLI core only as a fallback, for a project with no core pin', async () => {
    // A project whose generators are all local has no published core to
    // read, so the CLI's core is the only choice.
    const denoJson = RootDenoJson.create('test')

    const changed = await ensureWorkerDeps(denoJson, { findWorkerVersion: noLookup })

    assertEquals(changed, true)
    assertEquals(denoJson.contents.imports?.['@skmtc/core'], `jsr:@skmtc/core@${readCliCorePin()}`)
  })

  await t.step('pins the exact lower bound of the CLI core range', async () => {
    const denoJson = RootDenoJson.create('test')

    await ensureWorkerDeps(denoJson, { findWorkerVersion: noLookup })

    assertEquals(cliDenoJson.imports['@skmtc/core'].startsWith('jsr:@skmtc/core@^'), true)
    assertEquals(
      denoJson.contents.imports?.['@skmtc/core'],
      cliDenoJson.imports['@skmtc/core'].replace('@^', '@')
    )
  })

  await t.step('a core with the worker entry needs no @skmtc/worker pin', async () => {
    const denoJson = RootDenoJson.create('test')
    denoJson.addImport('@skmtc/core', 'jsr:@skmtc/core@0.39.0')

    const changed = await ensureWorkerDeps(denoJson, { findWorkerVersion: noLookup })

    assertEquals(changed, false)
    assertEquals(toWorkerModule(denoJson.contents.imports?.['@skmtc/core']), '@skmtc/core/worker')
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], undefined)
  })

  await t.step('an older stack gets the worker built on its own core, not the CLI one', async () => {
    // The CLI's worker runs on the CLI's core. A stack on core 0.38 needs
    // a worker on 0.38, or the bundle holds two cores.
    const denoJson = RootDenoJson.create('test')
    denoJson.addImport('@skmtc/core', 'jsr:@skmtc/core@0.38.0')
    const asked: string[] = []

    const changed = await ensureWorkerDeps(denoJson, {
      findWorkerVersion: coreVersion => {
        asked.push(coreVersion)
        return Promise.resolve('0.3.74')
      }
    })

    assertEquals(changed, true)
    assertEquals(asked, ['0.38.0'])
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], 'jsr:@skmtc/worker@0.3.74')
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'] === `jsr:@skmtc/worker@${readCliWorkerPin()}`, false)
  })

  await t.step('an older stack with no matching worker stops with the fix to apply', async () => {
    const denoJson = RootDenoJson.create('test')
    denoJson.addImport('@skmtc/core', 'jsr:@skmtc/core@0.0.1')

    const error = await assertRejects(() =>
      ensureWorkerDeps(denoJson, { findWorkerVersion: () => Promise.resolve(null) })
    )

    assertEquals(String(error).includes('@skmtc/core 0.0.1'), true)
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], undefined)
  })

  await t.step('never overwrites an existing pin (e.g. a local-checkout override)', async () => {
    const denoJson = RootDenoJson.create('test')
    denoJson.addImport('@skmtc/worker', '../../worker/mod.ts')
    denoJson.addImport('@skmtc/core', 'jsr:@skmtc/core@0.0.1')

    const changed = await ensureWorkerDeps(denoJson, { findWorkerVersion: noLookup })

    assertEquals(changed, false)
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], '../../worker/mod.ts')
    assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.0.1')
  })

  await t.step('leaves unrelated imports untouched', async () => {
    const denoJson = RootDenoJson.create('test')
    denoJson.addImport('@scope/gen-x', './gen-x/mod.ts')

    await ensureWorkerDeps(denoJson, { findWorkerVersion: noLookup })

    assertEquals(denoJson.contents.imports?.['@scope/gen-x'], './gen-x/mod.ts')
  })
})
