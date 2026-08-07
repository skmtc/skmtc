import { assertEquals } from '@std/assert'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import { readCliCorePin, readCliServerPin } from '@/lib/doctor-headless.ts'
import { ensureServerDeps } from '@/lib/ensure-server-deps.ts'

const serverPin = `jsr:@skmtc/server@${readCliServerPin()}`
const corePin = `jsr:@skmtc/core@${readCliCorePin()}`

const withImports = (imports: Record<string, string>): RootDenoJson => {
  const denoJson = RootDenoJson.create('test-project')
  for (const [key, value] of Object.entries(imports)) {
    denoJson.addImport(key, value)
  }
  return denoJson
}

Deno.test('ensureServerDeps - pins both peers in a fresh project', () => {
  const denoJson = withImports({})

  assertEquals(ensureServerDeps(denoJson), true)
  assertEquals(denoJson.contents.imports?.['@skmtc/server'], serverPin)
  assertEquals(denoJson.contents.imports?.['@skmtc/core'], corePin)
})

Deno.test('ensureServerDeps - repins a stale @skmtc/server version', () => {
  // The generated `server.ts` is rewritten from the CLI's template on every
  // publish, so a project left on an older server release loads an entry
  // importing symbols that release does not export.
  //
  // The fixture is 0.0.1 so it can never equal the CLI's own pin. Pinning a
  // fixture to a real past release made this test vacuous: `ensureCurrentPin`
  // took its `current === wanted` early return, and the assertion below passed
  // on the *core* pin being added instead.
  const denoJson = withImports({ '@skmtc/server': 'jsr:@skmtc/server@0.0.1' })

  assertEquals(ensureServerDeps(denoJson), true)
  assertEquals(denoJson.contents.imports?.['@skmtc/server'], serverPin)
})

Deno.test('ensureServerDeps - repins the server even when core is current', () => {
  // Isolates `ensureCurrentPin`: core needs no work, so `changed` can only be
  // true if the server pin was actually rewritten. Deleting `ensureCurrentPin`
  // fails this test, which is what the case above could not do.
  const denoJson = withImports({
    '@skmtc/server': 'jsr:@skmtc/server@0.0.1',
    '@skmtc/core': corePin
  })

  assertEquals(ensureServerDeps(denoJson), true)
  assertEquals(denoJson.contents.imports?.['@skmtc/server'], serverPin)
  assertEquals(denoJson.contents.imports?.['@skmtc/core'], corePin)
})

Deno.test('ensureServerDeps - leaves a local @skmtc/server override alone', () => {
  const denoJson = withImports({ '@skmtc/server': '../server/mod.ts' })

  ensureServerDeps(denoJson)
  assertEquals(denoJson.contents.imports?.['@skmtc/server'], '../server/mod.ts')
})

Deno.test('ensureServerDeps - reports no change when the pins are current', () => {
  const denoJson = withImports({ '@skmtc/server': serverPin, '@skmtc/core': corePin })

  assertEquals(ensureServerDeps(denoJson), false)
})

Deno.test('ensureServerDeps - never rewrites a deliberate @skmtc/core pin', () => {
  // Core is shared with the project's generator source, which may pin it on
  // purpose; `skmtc doctor` warns on skew instead.
  const denoJson = withImports({ '@skmtc/core': 'jsr:@skmtc/core@0.20.0' })

  ensureServerDeps(denoJson)
  assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.20.0')
})
