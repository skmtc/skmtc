import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { toFileUrl } from '@std/path/to-file-url'
import {
  checkModuleGraph,
  type ModuleGraph,
  toDuplicatePackagesMessage,
  toModuleGraphCheck
} from '@/lib/duplicate-packages.ts'
import {
  twoCoreRegistry,
  withJsrRegistryServer,
  withRegistryProject
} from '@/tests/mocks/jsr-registry-server.mock.ts'

const registryUrl = 'https://jsr.io'
const projectPath = resolve('/root/.skmtc/api')

type ModuleArgs = {
  specifier: string
  dependencies?: string[]
  error?: string
}

const toModule = ({ specifier, dependencies = [], error }: ModuleArgs) => ({
  specifier,
  error,
  dependencies: dependencies.map(dependency => ({ code: { specifier: dependency } }))
})

/**
 * The graph from the ticket's reproduction (CLI 0.9.47 + the current
 * stock generators), trimmed to one module per package.
 */
const ticketGraph: ModuleGraph = {
  modules: [
    toModule({
      specifier: toFileUrl(join(projectPath, 'worker.ts')).href,
      dependencies: [
        'jsr:@skmtc/worker@0.3.55',
        'jsr:@skmtc/gen-typescript@0.2.7',
        'jsr:@skmtc/gen-zod@0.2.7'
      ]
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/worker/0.3.55/mod.ts',
      dependencies: ['jsr:@skmtc/core@0.28.7', 'jsr:@skmtc/core@0.28.7/Settings']
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/gen-typescript/0.2.7/mod.ts',
      dependencies: ['jsr:@skmtc/core@0.29.0', 'jsr:@skmtc/lang-typescript@0.12.22']
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
      dependencies: ['jsr:@skmtc/core@0.29.0', 'jsr:@skmtc/lang-typescript@0.12.22']
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts',
      dependencies: ['jsr:@skmtc/core@0.29.0']
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/core/0.28.7/mod.ts',
      dependencies: ['https://jsr.io/@skmtc/core/0.28.7/dsl/Definition.ts']
    }),
    toModule({ specifier: 'https://jsr.io/@skmtc/core/0.28.7/dsl/Definition.ts' }),
    toModule({ specifier: 'https://jsr.io/@skmtc/core/0.28.7/types/Settings.ts' }),
    toModule({ specifier: 'https://jsr.io/@skmtc/core/0.29.0/mod.ts' })
  ],
  redirects: {
    'jsr:@skmtc/worker@0.3.55': 'https://jsr.io/@skmtc/worker/0.3.55/mod.ts',
    'jsr:@skmtc/gen-typescript@0.2.7': 'https://jsr.io/@skmtc/gen-typescript/0.2.7/mod.ts',
    'jsr:@skmtc/gen-zod@0.2.7': 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
    'jsr:@skmtc/lang-typescript@0.12.22': 'https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts',
    'jsr:@skmtc/core@0.28.7': 'https://jsr.io/@skmtc/core/0.28.7/mod.ts',
    'jsr:@skmtc/core@0.28.7/Settings': 'https://jsr.io/@skmtc/core/0.28.7/types/Settings.ts',
    'jsr:@skmtc/core@0.29.0': 'https://jsr.io/@skmtc/core/0.29.0/mod.ts'
  }
}

Deno.test('toModuleGraphCheck - names each core version and the packages that import it', () => {
  const result = toModuleGraphCheck({ graph: ticketGraph, projectPath, registryUrl })

  assertEquals(result, {
    type: 'duplicates',
    duplicates: [
      {
        name: '@skmtc/core',
        copies: [
          { version: '0.28.7', importedBy: ['@skmtc/worker@0.3.55'] },
          {
            version: '0.29.0',
            importedBy: [
              '@skmtc/gen-typescript@0.2.7',
              '@skmtc/gen-zod@0.2.7',
              '@skmtc/lang-typescript@0.12.22'
            ]
          }
        ]
      }
    ]
  })
})

Deno.test('toModuleGraphCheck - one core is not a duplicate', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['jsr:@skmtc/core@0.29.0']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
        dependencies: ['jsr:@skmtc/core@0.29.0', 'jsr:@skmtc/lang-typescript@0.12.22']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts',
        dependencies: ['jsr:@skmtc/core@0.29.0']
      })
    ],
    redirects: {
      'jsr:@skmtc/core@0.29.0': 'https://jsr.io/@skmtc/core/0.29.0/mod.ts',
      'jsr:@skmtc/lang-typescript@0.12.22': 'https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts'
    }
  }

  assertEquals(toModuleGraphCheck({ graph, projectPath, registryUrl }), {
    type: 'single-copies',
    packages: [
      {
        name: '@skmtc/core',
        copies: [
          {
            version: '0.29.0',
            importedBy: [
              '@skmtc/gen-zod@0.2.7',
              '@skmtc/lang-typescript@0.12.22',
              '@skmtc/worker@0.3.56'
            ]
          }
        ]
      },
      {
        name: '@skmtc/lang-typescript',
        copies: [{ version: '0.12.22', importedBy: ['@skmtc/gen-zod@0.2.7'] }]
      }
    ]
  })
})

Deno.test('toModuleGraphCheck - flags two copies of a lang package', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/gen-typescript/0.2.6/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/lang-typescript/0.12.10/mod.ts']
      })
    ]
  }

  const result = toModuleGraphCheck({ graph, projectPath, registryUrl })

  assertEquals(result.type, 'duplicates')
  assertEquals(result.type === 'duplicates' ? result.duplicates : [], [
    {
      name: '@skmtc/lang-typescript',
      copies: [
        { version: '0.12.10', importedBy: ['@skmtc/gen-typescript@0.2.6'] },
        { version: '0.12.22', importedBy: ['@skmtc/gen-zod@0.2.7'] }
      ]
    }
  ])
})

Deno.test('toModuleGraphCheck - names a local file that imports a core copy by its project path', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: toFileUrl(join(projectPath, 'gen-local', 'mod.ts')).href,
        dependencies: ['https://jsr.io/@skmtc/core/0.28.3/mod.ts']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/core/0.29.0/mod.ts']
      })
    ]
  }

  const result = toModuleGraphCheck({ graph, projectPath, registryUrl })

  assertEquals(result.type === 'duplicates' ? result.duplicates[0].copies : [], [
    { version: '0.28.3', importedBy: [join('gen-local', 'mod.ts')] },
    { version: '0.29.0', importedBy: ['@skmtc/worker@0.3.56'] }
  ])
})

Deno.test('toModuleGraphCheck - a partly resolved graph without duplicates is unavailable', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/core/0.29.0/mod.ts']
      }),
      toModule({ specifier: 'jsr:@skmtc/gen-zod@0.2.7', error: 'failed to load' })
    ]
  }

  const result = toModuleGraphCheck({ graph, projectPath, registryUrl })

  assertEquals(result.type, 'unavailable')
  assertStringIncludes(result.type === 'unavailable' ? result.reason : '', 'jsr:@skmtc/gen-zod')
})

Deno.test('toModuleGraphCheck - a module from another registry is not a JSR package', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: [
          'https://jsr.io/@skmtc/core/0.29.0/mod.ts',
          'https://esm.sh/@skmtc/core/0.28.7/mod.ts'
        ]
      })
    ]
  }

  assertEquals(toModuleGraphCheck({ graph, projectPath, registryUrl }).type, 'single-copies')
})

Deno.test('toDuplicatePackagesMessage - names the versions, the packages and the fix', () => {
  const result = toModuleGraphCheck({ graph: ticketGraph, projectPath, registryUrl })
  const message = toDuplicatePackagesMessage({
    projectName: 'api',
    projectPath,
    duplicates: result.type === 'duplicates' ? result.duplicates : []
  })

  assertStringIncludes(message, 'Project "api" resolves more than one copy of @skmtc/core')
  assertStringIncludes(message, '@skmtc/core 0.28.7 ← @skmtc/worker@0.3.55')
  assertStringIncludes(
    message,
    '@skmtc/core 0.29.0 ← @skmtc/gen-typescript@0.2.7, @skmtc/gen-zod@0.2.7, @skmtc/lang-typescript@0.12.22'
  )
  assertStringIncludes(message, 'empty files')
  assertStringIncludes(message, join(projectPath, 'deno.json'))
  assertStringIncludes(message, 'skmtc bundle api')
})

Deno.test('checkModuleGraph - resolves two cores from a real `deno info` run', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject({ generatorVersion: '0.2.0' }, async ({ projectPath }) => {
      assertEquals(await checkModuleGraph(projectPath), {
        type: 'duplicates',
        duplicates: [
          {
            name: '@skmtc/core',
            copies: [
              { version: '0.1.0', importedBy: ['@skmtc/worker@0.1.0'] },
              { version: '0.2.0', importedBy: ['@skmtc/gen-a@0.2.0'] }
            ]
          }
        ]
      })
    })
  })
})

Deno.test('checkModuleGraph - resolves one core from a real `deno info` run', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject({ generatorVersion: '0.1.0' }, async ({ projectPath }) => {
      assertEquals(await checkModuleGraph(projectPath), {
        type: 'single-copies',
        packages: [
          {
            name: '@skmtc/core',
            copies: [
              { version: '0.1.0', importedBy: ['@skmtc/gen-a@0.1.0', '@skmtc/worker@0.1.0'] }
            ]
          }
        ]
      })
    })
  })
})

Deno.test('checkModuleGraph - a project without worker.ts is unavailable', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    const result = await checkModuleGraph(projectPath)
    assertEquals(result.type, 'unavailable')
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})
