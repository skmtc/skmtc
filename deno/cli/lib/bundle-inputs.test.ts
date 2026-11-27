import { assert } from '@std/assert/assert'
import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { existsSync } from '@std/fs/exists'
import { join } from '@std/path/join'
import { createBundle } from '@/lib/create-bundle.ts'
import { openBundleProject } from '@/lib/bundle-project.ts'
import { Manager } from '@/lib/manager.ts'
import {
  type BundleVersions,
  readBundleRecord,
  toBundleRecordPath,
  toLockKey
} from '@/lib/bundle-inputs.ts'
import {
  twoCoreRegistry,
  withJsrRegistryServer,
  withRegistryProject
} from '@/tests/mocks/jsr-registry-server.mock.ts'

const versions: BundleVersions = { cliVersion: '1.0.0', denoVersion: '2.0.0' }

/** Runs `fn` and counts the `deno` subprocesses it starts. */
const countCommands = async (
  fn: () => Promise<unknown>,
  onCommand: (options?: Deno.CommandOptions) => void = () => {}
): Promise<number> => {
  const OriginalCommand = Deno.Command
  let count = 0
  class CountingCommand extends OriginalCommand {
    constructor(command: string | URL, options?: Deno.CommandOptions) {
      count += 1
      onCommand(options)
      super(command, options)
    }
  }
  Object.defineProperty(Deno, 'Command', {
    value: CountingCommand,
    configurable: true,
    writable: true
  })
  try {
    await fn()
    return count
  } finally {
    Object.defineProperty(Deno, 'Command', {
      value: OriginalCommand,
      configurable: true,
      writable: true
    })
  }
}

type GenerateArgs = {
  projectName: string
  versions?: BundleVersions
}

/** The build `generate` runs: one that reuses a current bundle. */
const generateBuild = async ({ projectName, versions: runVersions = versions }: GenerateArgs) =>
  await createBundle({
    project: await openBundleProject(projectName, new Manager()),
    reuse: true,
    versions: runVersions
  })

const countGenerateBuild = (args: GenerateArgs): Promise<number> =>
  countCommands(() => generateBuild(args))

const updateJson = async (path: string, update: (json: Record<string, unknown>) => void) => {
  const json = JSON.parse(await Deno.readTextFile(path))
  update(json)
  await Deno.writeTextFile(path, JSON.stringify(json, null, 2))
}

/** A cloned generator: a workspace member with its own `deno.json`, imported by path. */
const withClonedProject = (
  fn: (project: { projectName: string; projectPath: string }) => Promise<void>
) =>
  withJsrRegistryServer(twoCoreRegistry, () =>
    withRegistryProject(
      { generatorVersion: '0.1.0', imports: { '@skmtc/gen-c': './gen-c/mod.ts' } },
      async ({ projectName, projectPath }) => {
        await Deno.mkdir(join(projectPath, 'gen-c', 'src'), { recursive: true })
        await Deno.writeTextFile(
          join(projectPath, 'gen-c', 'deno.json'),
          JSON.stringify({ name: '@skmtc/gen-c', version: '0.1.0', exports: './mod.ts' })
        )
        await Deno.writeTextFile(
          join(projectPath, 'gen-c', 'mod.ts'),
          "import { label } from './src/label.ts'\nexport default { id: '@skmtc/gen-c', label }\n"
        )
        await Deno.writeTextFile(
          join(projectPath, 'gen-c', 'src', 'label.ts'),
          "export const label = 'first'\n"
        )
        await updateJson(join(projectPath, 'deno.json'), json => {
          json.workspace = ['./gen-c']
        })
        await fn({ projectName, projectPath })
      }
    )
  )

Deno.test('toLockKey - names the deno.lock specifier of a registry import', () => {
  assertEquals(toLockKey('jsr:@skmtc/core@0.1.0'), 'jsr:@skmtc/core@0.1.0')
  assertEquals(toLockKey('jsr:@std/path@^1.0.0/join'), 'jsr:@std/path@^1.0.0')
  assertEquals(toLockKey('jsr:/@std/path@1/'), 'jsr:@std/path@1')
  assertEquals(toLockKey('jsr:@std/path'), 'jsr:@std/path@*')
  assertEquals(toLockKey('npm:chokidar@^4.0.3'), 'npm:chokidar@^4.0.3')
  assertEquals(toLockKey('npm:@scope/name@1.0.0/sub'), 'npm:@scope/name@1.0.0')
  assertEquals(toLockKey('./gen-c/mod.ts'), undefined)
  assertEquals(toLockKey('https://example.com/mod.ts'), undefined)
})

Deno.test('createBundle reuse - unchanged inputs: the second generate runs no deno subprocess', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    assert((await countGenerateBuild({ projectName })) > 0)
    assertEquals((await readBundleRecord(projectPath))?.cliVersion, '1.0.0')

    assertEquals(await countGenerateBuild({ projectName }), 0)
  })
})

Deno.test('createBundle reuse - each input changed on its own: it builds', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    await generateBuild({ projectName })

    const changes: [string, () => Promise<BundleVersions>][] = [
      [
        'deno.json',
        async () => {
          await updateJson(join(projectPath, 'deno.json'), json => {
            json.compilerOptions = { strict: true }
          })
          return versions
        }
      ],
      [
        'deno.lock',
        async () => {
          const lockPath = join(projectPath, 'deno.lock')
          await Deno.writeTextFile(lockPath, `${await Deno.readTextFile(lockPath)}\n`)
          return versions
        }
      ],
      [
        'a file of the cloned generator',
        async () => {
          await Deno.writeTextFile(
            join(projectPath, 'gen-c', 'src', 'label.ts'),
            "export const label = 'second'\n"
          )
          return versions
        }
      ],
      ['the CLI version', () => Promise.resolve({ ...versions, cliVersion: '1.0.1' })],
      ['the Deno version', () => Promise.resolve({ cliVersion: '1.0.1', denoVersion: '2.0.1' })]
    ]

    for (const [input, change] of changes) {
      const runVersions = await change()
      assert(
        (await countGenerateBuild({ projectName, versions: runVersions })) > 0,
        `changed ${input} but did not build`
      )
      assertEquals(
        await countGenerateBuild({ projectName, versions: runVersions }),
        0,
        `built again after ${input} with nothing changed`
      )
    }

    const bundle = await Deno.readTextFile(join(projectPath, 'bundle.js'))
    assert(bundle.includes('second'))
  })
})

Deno.test('createBundle reuse - without deno.lock it builds every time', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    await generateBuild({ projectName })

    for (const _run of [1, 2]) {
      await Deno.remove(join(projectPath, 'deno.lock'))
      assert((await countGenerateBuild({ projectName })) > 0)
    }
  })
})

Deno.test('createBundle reuse - with `lock` set in deno.json it builds every time', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    await Deno.remove(join(projectPath, 'deno.lock')).catch(() => undefined)
    await updateJson(join(projectPath, 'deno.json'), json => {
      json.lock = false
    })

    for (const _run of [1, 2]) {
      assert((await countGenerateBuild({ projectName })) > 0)
    }
    assertEquals(existsSync(join(projectPath, 'deno.lock')), false)
  })
})

Deno.test('createBundle reuse - an import the lock does not hold: it builds every time', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    // Nothing imports it, so no build puts it in the lock.
    await updateJson(join(projectPath, 'deno.json'), json => {
      json.imports = { ...Object(json.imports), '@skmtc/unused': 'jsr:@skmtc/core@^0.1.0' }
    })

    for (const _run of [1, 2, 3]) {
      assert((await countGenerateBuild({ projectName })) > 0)
    }
  })
})

Deno.test('createBundle reuse - a cloned generator with a range the lock does not hold: it builds every time', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    await updateJson(join(projectPath, 'gen-c', 'deno.json'), json => {
      json.imports = { '@skmtc/unused': 'jsr:@skmtc/core@^0.1.0' }
    })

    for (const _run of [1, 2]) {
      assert((await countGenerateBuild({ projectName })) > 0)
    }
  })
})

Deno.test('createBundle reuse - a refused graph is refused on every run and writes no record', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await generateBuild({ projectName })
        const goodRecord = await Deno.readTextFile(toBundleRecordPath(projectPath))

        // `@skmtc/gen-a@0.2.0` is on core 0.2.0: two cores in the graph.
        await updateJson(join(projectPath, 'deno.json'), json => {
          json.imports = { ...Object(json.imports), '@skmtc/gen-a': 'jsr:@skmtc/gen-a@0.2.0' }
        })

        for (const _run of [1, 2]) {
          await assertRejects(
            () => generateBuild({ projectName }),
            Error,
            'more than one copy of @skmtc/core'
          )
          assertEquals(await Deno.readTextFile(toBundleRecordPath(projectPath)), goodRecord)
        }
      }
    )
  })
})

Deno.test('createBundle reuse - a refused first build writes no record', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.2.0' },
      async ({ projectName, projectPath }) => {
        for (const _run of [1, 2]) {
          await assertRejects(() => generateBuild({ projectName }), Error, 'more than one copy')
          assertEquals(existsSync(toBundleRecordPath(projectPath)), false)
        }
      }
    )
  })
})

Deno.test('createBundle reuse - a missing bundle.js with a record present: it builds', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    await generateBuild({ projectName })
    await Deno.remove(join(projectPath, 'bundle.js'))
    assert(existsSync(toBundleRecordPath(projectPath)))

    assert((await countGenerateBuild({ projectName })) > 0)
    assert(existsSync(join(projectPath, 'bundle.js')))
  })
})

Deno.test('createBundle reuse - an unreadable record: it builds', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    await generateBuild({ projectName })
    await Deno.writeTextFile(toBundleRecordPath(projectPath), '{ not json')

    assert((await countGenerateBuild({ projectName })) > 0)
    assertEquals(await countGenerateBuild({ projectName }), 0)
  })
})

Deno.test('createBundle reuse - a file edited while the build runs: it writes no record', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    await generateBuild({ projectName })
    await Deno.writeTextFile(
      join(projectPath, 'gen-c', 'src', 'label.ts'),
      "export const label = 'second'\n"
    )

    await countCommands(
      () => generateBuild({ projectName }),
      options => {
        if (options?.args?.[0] === 'bundle') {
          Deno.writeTextFileSync(
            join(projectPath, 'gen-c', 'src', 'label.ts'),
            "export const label = 'third'\n"
          )
        }
      }
    )

    assertEquals(existsSync(toBundleRecordPath(projectPath)), false)
    assert((await countGenerateBuild({ projectName })) > 0)
  })
})

Deno.test('createBundle - without reuse it always builds, and writes the record', async () => {
  await withClonedProject(async ({ projectName, projectPath }) => {
    for (const _run of [1, 2]) {
      const count = await countCommands(async () =>
        createBundle({ project: await openBundleProject(projectName, new Manager()), versions })
      )
      assert(count > 0)
    }
    assertEquals((await readBundleRecord(projectPath))?.denoVersion, '2.0.0')
  })
})
