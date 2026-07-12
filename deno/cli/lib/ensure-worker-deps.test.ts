import { assertEquals } from '@std/assert'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import { ensureWorkerDeps } from '@/lib/ensure-worker-deps.ts'
import { readCliCorePin, readCliWorkerPin } from '@/lib/doctor-headless.ts'

Deno.test('ensureWorkerDeps', async t => {
  await t.step('adds @skmtc/worker and @skmtc/core when absent', () => {
    // A freshly cloned/created local-generator project has only the
    // `@scope/gen-*` local mappings — the CLI-generated worker.ts
    // imports `@skmtc/worker` and the generator source imports
    // `@skmtc/core`, so without these `deno bundle` fails.
    const denoJson = RootDenoJson.create('test')

    const changed = ensureWorkerDeps(denoJson)

    assertEquals(changed, true)
    assertEquals(
      denoJson.contents.imports?.['@skmtc/worker'],
      `jsr:@skmtc/worker@${readCliWorkerPin()}`
    )
    assertEquals(denoJson.contents.imports?.['@skmtc/core'], `jsr:@skmtc/core@${readCliCorePin()}`)
  })

  await t.step('never overwrites an existing pin (e.g. a local-checkout override)', () => {
    const denoJson = RootDenoJson.create('test')
    denoJson.addImport('@skmtc/worker', '../../worker/mod.ts')
    denoJson.addImport('@skmtc/core', 'jsr:@skmtc/core@0.0.1')

    const changed = ensureWorkerDeps(denoJson)

    assertEquals(changed, false)
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'], '../../worker/mod.ts')
    assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.0.1')
  })

  await t.step('leaves unrelated imports untouched', () => {
    const denoJson = RootDenoJson.create('test')
    denoJson.addImport('@scope/gen-x', './gen-x/mod.ts')

    ensureWorkerDeps(denoJson)

    assertEquals(denoJson.contents.imports?.['@scope/gen-x'], './gen-x/mod.ts')
    assertEquals(denoJson.contents.imports?.['@skmtc/worker'] !== undefined, true)
  })
})
