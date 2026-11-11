import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { assertThrows } from '@std/assert/throws'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import {
  CoreConflictError,
  FIRST_CORE_WITH_WORKER,
  findWorkerVersionForCore,
  readPublishedCoreRequirement,
  reconcileCorePin,
  toCoreRequirement,
  toCoreRequirementFromDenoJson,
  toWorkerModule
} from '@/lib/stack-core.ts'

/** Package name → version → that version's `deno.json` imports. */
type Registry = Record<string, Record<string, Record<string, string>>>

const registry: Registry = {
  '@skmtc/worker': {
    '0.3.72': { '@skmtc/core': 'jsr:@skmtc/core@^0.36.0' },
    '0.3.73': { '@skmtc/core': 'jsr:@skmtc/core@^0.37.0' },
    '0.3.74': { '@skmtc/core': 'jsr:@skmtc/core@^0.38.0' }
  },
  '@skmtc/gen-zod': {
    '0.2.13': { '@skmtc/core': 'jsr:@skmtc/core@0.38.0' }
  }
}

/** Serves `registry` as JSR's `meta.json` and `<version>/deno.json`, with `JSR_URL` pointed at it. */
const withRegistry = async (fn: () => Promise<void>) => {
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, request => {
    const { pathname } = new URL(request.url)
    const match = pathname.match(/^\/(@[^/]+\/[^/]+)\/(meta\.json|([^/]+)\/deno\.json)$/)
    const versions = match ? registry[match[1]] : undefined

    if (match === null || versions === undefined) {
      return new Response('not found', { status: 404 })
    }

    if (match[2] === 'meta.json') {
      return Response.json({ versions: Object.fromEntries(Object.keys(versions).map(v => [v, {}])) })
    }

    const imports = versions[match[3]]
    return imports === undefined
      ? new Response('not found', { status: 404 })
      : Response.json({ name: match[1], version: match[3], imports })
  })

  try {
    await withEnv({ JSR_URL: `http://127.0.0.1:${server.addr.port}/` }, fn)
  } finally {
    await server.shutdown()
  }
}

const toDenoJson = (imports: Record<string, string>): RootDenoJson => {
  const denoJson = RootDenoJson.create('project')
  Object.entries(imports).forEach(([key, value]) => denoJson.addImport(key, value))
  return denoJson
}

Deno.test('toCoreRequirement - reads an exact pin and a caret range', () => {
  assertEquals(toCoreRequirement('jsr:@skmtc/core@0.38.0'), { version: '0.38.0', exact: true })
  assertEquals(toCoreRequirement('jsr:@skmtc/core@^0.38.0'), { version: '0.38.0', exact: false })
})

Deno.test('toCoreRequirement - ignores anything that is not a jsr core pin', () => {
  assertEquals(toCoreRequirement(undefined), null)
  assertEquals(toCoreRequirement('../core/mod.ts'), null)
  assertEquals(toCoreRequirement('jsr:@skmtc/core@latest'), null)
})

Deno.test('toCoreRequirementFromDenoJson - reads the core pin from a published deno.json', () => {
  const denoJson = { name: '@skmtc/gen-zod', imports: { '@skmtc/core': 'jsr:@skmtc/core@0.38.0' } }

  assertEquals(toCoreRequirementFromDenoJson(denoJson), { version: '0.38.0', exact: true })
  // A generator that never imports core has no requirement.
  assertEquals(toCoreRequirementFromDenoJson({ imports: { 'ts-pattern': 'npm:ts-pattern@5' } }), null)
  assertEquals(toCoreRequirementFromDenoJson('not an object'), null)
})

Deno.test('toWorkerModule - a core that ships the worker entry imports it from core', () => {
  assertEquals(toWorkerModule(`jsr:@skmtc/core@${FIRST_CORE_WITH_WORKER}`), '@skmtc/core/worker')
  assertEquals(toWorkerModule('jsr:@skmtc/core@1.0.0'), '@skmtc/core/worker')
})

Deno.test('toWorkerModule - an older core keeps @skmtc/worker, so its stacks still bundle', () => {
  assertEquals(toWorkerModule('jsr:@skmtc/core@0.38.0'), '@skmtc/worker')
  assertEquals(toWorkerModule('jsr:@skmtc/core@0.37.0'), '@skmtc/worker')
  assertEquals(toWorkerModule(undefined), '@skmtc/worker')
})

Deno.test('toWorkerModule - a local core checkout is taken to be current', () => {
  assertEquals(toWorkerModule('../../skmtc/deno/core/mod.ts'), '@skmtc/core/worker')
})

Deno.test('reconcileCorePin - pins the generator core when the project has none', () => {
  const denoJson = toDenoJson({})

  reconcileCorePin({
    denoJson,
    generatorId: '@skmtc/gen-zod',
    requirement: { version: '0.38.0', exact: true }
  })

  assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.38.0')
})

Deno.test('reconcileCorePin - a pin from an older CLI default moves to the generator core', () => {
  // A project with no generators yet got its core from the CLI. The stack
  // decides, so the first generator replaces it, and the stale worker pin
  // goes with it.
  const denoJson = toDenoJson({
    '@skmtc/core': 'jsr:@skmtc/core@0.38.0',
    '@skmtc/worker': 'jsr:@skmtc/worker@0.3.74'
  })

  reconcileCorePin({
    denoJson,
    generatorId: '@skmtc/gen-zod',
    requirement: { version: '0.37.0', exact: true }
  })

  assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.37.0')
  assertEquals(denoJson.contents.imports?.['@skmtc/worker'], undefined)
})

Deno.test('reconcileCorePin - refuses a generator on another core and leaves deno.json alone', () => {
  const imports = {
    '@skmtc/core': 'jsr:@skmtc/core@0.38.0',
    '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.13'
  }
  const denoJson = toDenoJson(imports)

  const error = assertThrows(
    () =>
      reconcileCorePin({
        denoJson,
        generatorId: '@skmtc/gen-zod',
        requirement: { version: '0.37.0', exact: true }
      }),
    CoreConflictError
  )

  assertEquals(error.message.includes('@skmtc/gen-zod needs @skmtc/core 0.37.0'), true)
  assertEquals(error.message.includes('@skmtc/gen-typescript'), true)
  // Nothing was written: the project still runs the core its generators use.
  assertEquals(denoJson.contents.imports, imports)
})

Deno.test('reconcileCorePin - an exact pin needs that exact version, not just the same minor', () => {
  // Two exact pins a patch apart resolve two copies of core, which is the
  // empty-output failure the one-core rule exists to prevent.
  const denoJson = toDenoJson({
    '@skmtc/core': 'jsr:@skmtc/core@0.38.0',
    '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.13'
  })

  assertThrows(
    () =>
      reconcileCorePin({
        denoJson,
        generatorId: '@skmtc/gen-zod',
        requirement: { version: '0.38.1', exact: true }
      }),
    CoreConflictError
  )
})

Deno.test('reconcileCorePin - a caret range accepts a later patch of the same minor', () => {
  const imports = {
    '@skmtc/core': 'jsr:@skmtc/core@0.38.2',
    '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.13'
  }
  const denoJson = toDenoJson(imports)

  reconcileCorePin({
    denoJson,
    generatorId: '@skmtc/gen-zod',
    requirement: { version: '0.38.0', exact: false }
  })

  assertEquals(denoJson.contents.imports, imports)
})

Deno.test('reconcileCorePin - a local core override is the user’s and is never replaced', () => {
  const imports = {
    '@skmtc/core': '../../skmtc/deno/core/mod.ts',
    '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.13'
  }
  const denoJson = toDenoJson(imports)

  reconcileCorePin({
    denoJson,
    generatorId: '@skmtc/gen-zod',
    requirement: { version: '0.37.0', exact: true }
  })

  assertEquals(denoJson.contents.imports, imports)
})

Deno.test('readPublishedCoreRequirement - reads the core a published version pins', async () => {
  await withRegistry(async () => {
    assertEquals(
      await readPublishedCoreRequirement({ scopeName: '@skmtc', packageName: 'gen-zod', version: '0.2.13' }),
      { version: '0.38.0', exact: true }
    )
  })
})

Deno.test('readPublishedCoreRequirement - a missing version fails with the URL it tried', async () => {
  await withRegistry(async () => {
    const error = await assertRejects(() =>
      readPublishedCoreRequirement({ scopeName: '@skmtc', packageName: 'gen-zod', version: '9.9.9' })
    )
    assertEquals(String(error).includes('/@skmtc/gen-zod/9.9.9/deno.json'), true)
  })
})

Deno.test('findWorkerVersionForCore - picks the newest worker built on that core', async () => {
  await withRegistry(async () => {
    assertEquals(await findWorkerVersionForCore('0.38.0'), '0.3.74')
    assertEquals(await findWorkerVersionForCore('0.37.4'), '0.3.73')
  })
})

Deno.test('findWorkerVersionForCore - no worker on that core is null, not the newest worker', async () => {
  // Falling back to the newest worker would bundle a second core.
  await withRegistry(async () => {
    assertEquals(await findWorkerVersionForCore('0.30.0'), null)
  })
})
