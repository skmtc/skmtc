import { assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'
import { homedir } from 'node:os'
import { checkBundleFreshness } from '@/lib/bundle-freshness.ts'

/**
 * Build an isolated SKMTC root for each test.
 *
 * `toRootPath` (the resolver used internally) walks `cwd()` upward
 * looking for an existing `.skmtc/` directory and stops at $HOME. We
 * therefore create the temp root *inside* the user's home dir (so
 * the upward walk reaches it) and `cd` into it for the duration of
 * the test.
 */
const withProject = async (
  fn: (args: {
    projectName: string
    writeDenoJson: (imports: Record<string, string>) => void
    writeWorker: (generatorIds: string[]) => void
  }) => Promise<void> | void
) => {
  const tempRoot = await Deno.makeTempDir({
    prefix: 'skmtc-bundle-freshness-',
    dir: homedir()
  })
  const projectName = 'freshness-test'
  const projectPath = join(tempRoot, '.skmtc', projectName)
  await ensureDir(projectPath)

  const prevCwd = Deno.cwd()
  Deno.chdir(tempRoot)

  const writeDenoJson = (imports: Record<string, string>) => {
    Deno.writeTextFileSync(
      join(projectPath, 'deno.json'),
      JSON.stringify({ imports }, null, 2)
    )
  }

  const writeWorker = (generatorIds: string[]) => {
    const importLines = generatorIds
      .map((id, i) => `import gen${i} from '${id}'`)
      .join('\n')
    Deno.writeTextFileSync(
      join(projectPath, 'worker.ts'),
      `import toWorker from '@skmtc/worker'\n${importLines}\n\nexport default toWorker(() => ({}))`
    )
  }

  try {
    await fn({ projectName, writeDenoJson, writeWorker })
  } finally {
    Deno.chdir(prevCwd)
    await Deno.remove(tempRoot, { recursive: true })
  }
}

Deno.test('checkBundleFreshness - returns no-local-bundle for remote-only projects', async () => {
  await withProject(async ({ projectName, writeDenoJson }) => {
    // Remote-only: every generator import is a `jsr:` specifier.
    writeDenoJson({
      '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.0.55',
      '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@0.0.55'
    })

    const result = checkBundleFreshness({ projectName })
    assertEquals(result.kind, 'no-local-bundle')
  })
})

Deno.test('checkBundleFreshness - returns fresh when deno.json and worker.ts agree', async () => {
  await withProject(async ({ projectName, writeDenoJson, writeWorker }) => {
    writeDenoJson({
      '@skmtc/gen-typescript': './gen-typescript/mod.ts',
      '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@0.0.55'
    })
    writeWorker(['@skmtc/gen-typescript', '@skmtc/gen-zod'])

    const result = checkBundleFreshness({ projectName })
    assertEquals(result.kind, 'fresh')
  })
})

Deno.test('checkBundleFreshness - returns missing-worker when worker.ts absent', async () => {
  await withProject(async ({ projectName, writeDenoJson }) => {
    writeDenoJson({
      '@skmtc/gen-typescript': './gen-typescript/mod.ts'
    })
    // No writeWorker call — confirms the missing-worker outcome.

    const result = checkBundleFreshness({ projectName })
    assertEquals(result.kind, 'missing-worker')
  })
})

Deno.test('checkBundleFreshness - returns stale when deno.json adds a generator', async () => {
  await withProject(async ({ projectName, writeDenoJson, writeWorker }) => {
    writeDenoJson({
      '@skmtc/gen-typescript': './gen-typescript/mod.ts',
      // Just-added; worker.ts was built before this entry existed.
      '@skmtc/gen-shadcn-form': './gen-shadcn-form/mod.ts'
    })
    writeWorker(['@skmtc/gen-typescript'])

    const result = checkBundleFreshness({ projectName })
    assertEquals(result.kind, 'stale')
    if (result.kind === 'stale') {
      assertEquals(result.added, ['@skmtc/gen-shadcn-form'])
      assertEquals(result.removed, [])
    }
  })
})

Deno.test('checkBundleFreshness - returns stale when deno.json removes a generator', async () => {
  await withProject(async ({ projectName, writeDenoJson, writeWorker }) => {
    writeDenoJson({
      '@skmtc/gen-typescript': './gen-typescript/mod.ts'
    })
    // worker.ts knows about a generator that's no longer in deno.json.
    writeWorker(['@skmtc/gen-typescript', '@skmtc/gen-old'])

    const result = checkBundleFreshness({ projectName })
    assertEquals(result.kind, 'stale')
    if (result.kind === 'stale') {
      assertEquals(result.added, [])
      assertEquals(result.removed, ['@skmtc/gen-old'])
    }
  })
})

Deno.test(
  'checkBundleFreshness - filters non-generator imports from the comparison',
  async () => {
    await withProject(async ({ projectName, writeDenoJson, writeWorker }) => {
      writeDenoJson({
        '@skmtc/gen-typescript': './gen-typescript/mod.ts',
        // Non-generator imports must not count toward freshness; they
        // appear in deno.json (peer deps) but are not workspace
        // members that would surface in worker.ts.
        '@skmtc/core': 'jsr:@skmtc/core@0.3.7',
        '@std/path/join': 'jsr:@std/path@^1.1.2/join'
      })
      writeWorker(['@skmtc/gen-typescript'])

      const result = checkBundleFreshness({ projectName })
      assertEquals(result.kind, 'fresh')
    })
  }
)
