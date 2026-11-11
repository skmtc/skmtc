import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { assertThrows } from '@std/assert/throws'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import {
  applyCorePlan,
  CoreConflictError,
  FIRST_CORE_WITH_WORKER,
  findWorkerVersionForCore,
  planCorePin,
  readPublishedCoreRange,
  reconcileCorePin,
  toCorePin,
  toWorkerModule
} from '@/lib/stack-core.ts'

/** Package name → version → that version's `deno.json` imports (`null`: no deno.json). */
type Registry = Record<string, Record<string, Record<string, string> | null>>

const registry: Registry = {
  '@skmtc/gen-zod': {
    '0.2.12': { '@skmtc/core': 'jsr:@skmtc/core@0.37.0' },
    '0.2.13': { '@skmtc/core': 'jsr:@skmtc/core@0.38.0' },
    '0.3.0': { '@skmtc/core': 'jsr:@skmtc/core@0.39.0' }
  },
  '@skmtc/gen-typescript': {
    '0.2.13': { '@skmtc/core': 'jsr:@skmtc/core@0.38.0' },
    '0.3.0': { '@skmtc/core': 'jsr:@skmtc/core@0.39.0' }
  },
  // Reaches core only through lang-typescript.
  '@skmtc/gen-lang-only': {
    '0.1.0': { '@skmtc/lang-typescript': 'jsr:@skmtc/lang-typescript@0.12.41' }
  },
  '@skmtc/lang-typescript': {
    '0.12.41': { '@skmtc/core': 'jsr:@skmtc/core@^0.38.0' }
  },
  // Published with jsr.json, so the registry has no deno.json.
  '@skmtc/gen-jsr-json': {
    '0.1.0': null
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
      const names = Object.keys(versions)
      return Response.json({
        scope: match[1].split('/')[0].slice(1),
        name: match[1].split('/')[1],
        latest: names.at(-1),
        versions: Object.fromEntries(names.map(v => [v, {}]))
      })
    }

    const imports = versions[match[3]]
    return imports === undefined || imports === null
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

Deno.test('toCorePin - sorts a core import by what the CLI may do with it', () => {
  assertEquals(toCorePin('jsr:@skmtc/core@0.38.0'), { type: 'exact', version: '0.38.0' })
  assertEquals(toCorePin('jsr:@skmtc/core@^0.38.0'), { type: 'range', range: '^0.38.0' })
  assertEquals(toCorePin('jsr:@skmtc/core@0.38'), { type: 'range', range: '0.38' })
  assertEquals(toCorePin('jsr:@skmtc/core@latest'), { type: 'range', range: 'latest' })
  assertEquals(toCorePin('../../skmtc/deno/core/mod.ts'), { type: 'local', path: '../../skmtc/deno/core/mod.ts' })
  assertEquals(toCorePin('npm:@skmtc/core@0.38.0'), { type: 'other', value: 'npm:@skmtc/core@0.38.0' })
})

Deno.test('toWorkerModule - a jsr core with the worker entry imports it from core', () => {
  assertEquals(toWorkerModule({ '@skmtc/core': `jsr:@skmtc/core@${FIRST_CORE_WITH_WORKER}` }), '@skmtc/core/worker')
  assertEquals(toWorkerModule({ '@skmtc/core': 'jsr:@skmtc/core@1.0.0' }), '@skmtc/core/worker')
})

Deno.test('toWorkerModule - an older, ranged, npm or missing core keeps @skmtc/worker', () => {
  assertEquals(toWorkerModule({ '@skmtc/core': 'jsr:@skmtc/core@0.38.0' }), '@skmtc/worker')
  assertEquals(toWorkerModule({ '@skmtc/core': 'jsr:@skmtc/core@^0.39.0' }), '@skmtc/worker')
  // The npm build has no ./worker entry point.
  assertEquals(toWorkerModule({ '@skmtc/core': 'npm:@skmtc/core@0.39.0' }), '@skmtc/worker')
  assertEquals(toWorkerModule(undefined), '@skmtc/worker')
})

Deno.test('toWorkerModule - a local core needs an @skmtc/core/worker map entry', () => {
  // An import-map entry that points at a file resolves no subpaths, so a
  // bare `@skmtc/core/worker` would not resolve without its own entry.
  assertEquals(toWorkerModule({ '@skmtc/core': '../core/mod.ts' }), '@skmtc/worker')
  assertEquals(
    toWorkerModule({ '@skmtc/core': '../core/mod.ts', '@skmtc/core/worker': '../core/worker/mod.ts' }),
    '@skmtc/core/worker'
  )
})

Deno.test('planCorePin - pins one exact version for a project with no pin', () => {
  assertEquals(
    planCorePin({ current: undefined, requirements: [{ generatorId: '@skmtc/gen-zod', range: '0.38.0' }] }),
    { type: 'set', version: '0.38.0' }
  )
})

Deno.test('planCorePin - keeps an exact pin every generator accepts', () => {
  assertEquals(
    planCorePin({
      current: 'jsr:@skmtc/core@0.38.2',
      requirements: [
        { generatorId: '@skmtc/gen-zod', range: '^0.38.0' },
        { generatorId: '@skmtc/lang-typescript', range: '^0.38.1' }
      ]
    }),
    { type: 'keep' }
  )
})

Deno.test('planCorePin - moves the pin to a version that serves every range', () => {
  // gen-a accepts any 0.38 patch, gen-b needs 0.38.1 exactly: 0.38.1 serves both.
  assertEquals(
    planCorePin({
      current: 'jsr:@skmtc/core@0.38.0',
      requirements: [
        { generatorId: '@skmtc/gen-a', range: '^0.38.0' },
        { generatorId: '@skmtc/gen-b', range: '0.38.1' }
      ]
    }),
    { type: 'set', version: '0.38.1' }
  )
})

Deno.test('planCorePin - replaces a ranged project pin, which Deno resolves to the newest match', () => {
  assertEquals(
    planCorePin({
      current: 'jsr:@skmtc/core@^0.38.0',
      requirements: [{ generatorId: '@skmtc/gen-zod', range: '0.38.0' }]
    }),
    { type: 'set', version: '0.38.0' }
  )
})

Deno.test('planCorePin - follows semver caret rules for 0.0.x and 1.x', () => {
  // `^0.0.983` is `>=0.0.983 <0.0.984`, so a project on 0.0.990 would load a second core.
  assertEquals(
    planCorePin({ current: 'jsr:@skmtc/core@0.0.990', requirements: [{ generatorId: '@skmtc/gen-a', range: '^0.0.983' }] }),
    { type: 'set', version: '0.0.983' }
  )
  // `^1.2.0` accepts 1.3.0.
  assertEquals(
    planCorePin({ current: 'jsr:@skmtc/core@1.3.0', requirements: [{ generatorId: '@skmtc/gen-a', range: '^1.2.0' }] }),
    { type: 'keep' }
  )
})

Deno.test('planCorePin - no version serves every range: a conflict naming them all', () => {
  const requirements = [
    { generatorId: '@skmtc/gen-zod', range: '0.37.0' },
    { generatorId: '@skmtc/gen-typescript', range: '^0.38.0' }
  ]

  assertEquals(planCorePin({ current: 'jsr:@skmtc/core@0.38.0', requirements }), { type: 'conflict', requirements })
})

Deno.test('planCorePin - a range it cannot read is a conflict, not a skipped check', () => {
  const requirements = [{ generatorId: '@skmtc/gen-odd', range: 'not-a-range' }]

  assertEquals(planCorePin({ current: undefined, requirements }), { type: 'conflict', requirements })
})

Deno.test('planCorePin - a local or npm core is the user’s and is kept', () => {
  const requirements = [{ generatorId: '@skmtc/gen-zod', range: '0.37.0' }]

  assertEquals(planCorePin({ current: '../core/mod.ts', requirements }), { type: 'keep' })
  assertEquals(planCorePin({ current: 'npm:@skmtc/core@0.38.0', requirements }), { type: 'keep' })
})

Deno.test('applyCorePlan - drops a published worker pin with the old core, keeps a local one', () => {
  const published = toDenoJson({ '@skmtc/core': 'jsr:@skmtc/core@0.38.0', '@skmtc/worker': 'jsr:@skmtc/worker@0.3.74' })
  applyCorePlan({ denoJson: published, plan: { type: 'set', version: '0.37.0' } })
  assertEquals(published.contents.imports, { '@skmtc/core': 'jsr:@skmtc/core@0.37.0' })

  const local = toDenoJson({ '@skmtc/core': 'jsr:@skmtc/core@0.38.0', '@skmtc/worker': '../../worker/mod.ts' })
  applyCorePlan({ denoJson: local, plan: { type: 'set', version: '0.37.0' } })
  assertEquals(local.contents.imports?.['@skmtc/worker'], '../../worker/mod.ts')
})

Deno.test('applyCorePlan - a conflict throws and changes nothing', () => {
  const imports = { '@skmtc/core': 'jsr:@skmtc/core@0.38.0' }
  const denoJson = toDenoJson(imports)
  const requirements = [{ generatorId: '@skmtc/gen-zod', range: '0.37.0' }]

  const error = assertThrows(
    () => applyCorePlan({ denoJson, plan: { type: 'conflict', requirements } }),
    CoreConflictError
  )

  assertEquals(error.message.includes('@skmtc/gen-zod needs @skmtc/core 0.37.0'), true)
  assertEquals(denoJson.contents.imports, imports)
})

Deno.test('readPublishedCoreRange - reads the core a published version pins', async () => {
  await withRegistry(async () => {
    assertEquals(await readPublishedCoreRange('jsr:@skmtc/gen-zod@0.2.13'), '0.38.0')
  })
})

Deno.test('readPublishedCoreRange - resolves a version range before reading the file', async () => {
  // The registry serves files only under an exact version: `^0.2.0/deno.json` is a 404.
  await withRegistry(async () => {
    assertEquals(await readPublishedCoreRange('jsr:@skmtc/gen-zod@^0.2.0'), '0.38.0')
  })
})

Deno.test('readPublishedCoreRange - takes the core of the lang package when a generator names none', async () => {
  await withRegistry(async () => {
    assertEquals(await readPublishedCoreRange('jsr:@skmtc/gen-lang-only@0.1.0'), '^0.38.0')
  })
})

Deno.test('readPublishedCoreRange - a package with no deno.json names no core', async () => {
  await withRegistry(async () => {
    assertEquals(await readPublishedCoreRange('jsr:@skmtc/gen-jsr-json@0.1.0'), null)
  })
})

Deno.test('reconcileCorePin - moves every generator to a new core in one command', async () => {
  // Both generators move to core 0.39 together; checked one at a time,
  // each would conflict with the other's old version.
  await withRegistry(async () => {
    const denoJson = toDenoJson({
      '@skmtc/core': 'jsr:@skmtc/core@0.38.0',
      '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@0.2.13',
      '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.13'
    })

    await reconcileCorePin({
      denoJson,
      adding: [
        { generatorId: '@skmtc/gen-zod', range: '0.39.0' },
        { generatorId: '@skmtc/gen-typescript', range: '0.39.0' }
      ]
    })

    assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.39.0')
  })
})

Deno.test('reconcileCorePin - a generator that stays on the old core is a conflict', async () => {
  await withRegistry(async () => {
    const imports = {
      '@skmtc/core': 'jsr:@skmtc/core@0.38.0',
      '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@0.2.13',
      '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.13'
    }
    const denoJson = toDenoJson(imports)

    const error = await assertRejects(
      () => reconcileCorePin({ denoJson, adding: [{ generatorId: '@skmtc/gen-zod', range: '0.39.0' }] }),
      CoreConflictError
    )

    assertEquals(error.message.includes('@skmtc/gen-typescript needs @skmtc/core 0.38.0'), true)
    assertEquals(denoJson.contents.imports, imports)
  })
})

Deno.test('reconcileCorePin - a project with no pin is checked against the generators it has', async () => {
  await withRegistry(async () => {
    const denoJson = toDenoJson({ '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.13' })

    await assertRejects(
      () => reconcileCorePin({ denoJson, adding: [{ generatorId: '@skmtc/gen-zod', range: '0.37.0' }] }),
      CoreConflictError
    )
    assertEquals(denoJson.contents.imports?.['@skmtc/core'], undefined)
  })
})

Deno.test('findWorkerVersionForCore - picks the newest worker built on that core', () => {
  assertEquals(findWorkerVersionForCore('0.38.0'), '0.3.74')
  assertEquals(findWorkerVersionForCore('0.37.4'), '0.3.73')
  // 0.3.56 pins core 0.29.0 exactly and 0.3.57 accepts ^0.29.0: the newer wins.
  assertEquals(findWorkerVersionForCore('0.29.0'), '0.3.57')
  // A 0.0.x caret range accepts only its own patch.
  assertEquals(findWorkerVersionForCore('0.0.983'), '0.0.55')
})

Deno.test('findWorkerVersionForCore - no worker on that core is null, not the newest worker', () => {
  // Falling back to the newest worker would bundle a second core.
  assertEquals(findWorkerVersionForCore('0.30.0'), null)
  // From 0.39 on the worker entry ships with core.
  assertEquals(findWorkerVersionForCore('0.39.0'), null)
})
