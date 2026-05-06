import { assertEquals, assertStringIncludes } from '@std/assert'
import { dirname, fromFileUrl, join, resolve } from '@std/path'

/**
 * End-to-end smoke test for the GraphQL → CLI → output pipeline.
 *
 * Builds a self-contained project in a temp dir (deno.json + worker.ts
 * + bundle.js), drops a fixture `.graphql` schema next to it, and
 * shells out to `cli/mod.ts generate <project> <schema>` via
 * `Deno.Command`. Asserts on stdout: file count, parse-issue
 * formatting, and the precise issue lines that should fire for the
 * fixture schema.
 *
 * Slow (one bundle build per test run, ~1s) but full end-to-end —
 * catches any wire-shape regression in the worker → host channel
 * that unit tests would miss.
 */

const TEST_DIR = dirname(fromFileUrl(import.meta.url))
const CLI_DIR = resolve(TEST_DIR, '..')
const CLI_MOD = join(CLI_DIR, 'mod.ts')
const CLI_DENO_JSON = join(CLI_DIR, 'deno.json')
// Repo root contains skmtc/, skmtc-generators/. Used to point the
// fixture project's imports at the local source tree.
const REPO_ROOT = resolve(CLI_DIR, '..', '..', '..')

const PROJECT_NAME = 'gql-smoke'

const FIXTURE_SDL = /* GraphQL */ `
  directive @auth(role: String!) on FIELD_DEFINITION

  type User {
    id: ID!
    name: String!
    grid: [[Int]]
    posts(limit: Int): [Post!]!
  }

  type Post {
    id: ID!
    title: String!
  }

  type Query {
    me: User
  }
`

const FIXTURE_DENO_JSON = JSON.stringify(
  {
    imports: {
      '@skmtc/gen-typescript': join(REPO_ROOT, 'skmtc-generators/gen-typescript/mod.ts'),
      '@skmtc/gen-graphql-operation': join(
        REPO_ROOT,
        'skmtc-generators/gen-graphql-operation/mod.ts'
      ),
      '@skmtc/core': join(REPO_ROOT, 'skmtc/deno/core/mod.ts'),
      '@skmtc/core/parsers/graphql': join(
        REPO_ROOT,
        'skmtc/deno/core/parsers/graphql/mod.ts'
      ),
      '@skmtc/worker': join(REPO_ROOT, 'skmtc/deno/worker/mod.ts'),
      '@/': join(REPO_ROOT, 'skmtc/deno/core/'),
      '@std/path': 'jsr:@std/path@^1.1.2',
      '@std/log': 'jsr:@std/log@^0.224.6',
      '@std/log/base-handler': 'jsr:@std/log@^0.224.6/base-handler',
      '@std/fmt/colors': 'jsr:@std/fmt@^1.0.0/colors',
      '@types/lodash-es': 'npm:@types/lodash-es@4.17.12',
      'lodash-es/get': 'npm:lodash-es@4.17.21/get.js',
      'lodash-es/set': 'npm:lodash-es@4.17.21/set.js',
      'openapi-types': 'npm:openapi-types@^12.1.3',
      valibot: 'npm:valibot@1.1.0',
      'tiny-invariant': 'npm:tiny-invariant@^1.3.3',
      'ts-pattern': 'npm:ts-pattern@^5.8.0',
      graphql: 'npm:graphql@^16.9.0'
    }
  },
  null,
  2
)

const FIXTURE_WORKER = `
import toWorker from '@skmtc/worker'
import skmtcGenTypescript from '@skmtc/gen-typescript'
import skmtcGenGraphqlOperation from '@skmtc/gen-graphql-operation'

export default toWorker(() =>
  Object.fromEntries(
    [skmtcGenTypescript, skmtcGenGraphqlOperation].map(g => [g.id, g])
  )
)
`

const FIXTURE_CLIENT_JSON = JSON.stringify(
  {
    settings: { basePath: './generated' }
  },
  null,
  2
)

type SetupResult = {
  tempDir: string
  schemaPath: string
}

const setup = async (): Promise<SetupResult> => {
  const tempDir = await Deno.makeTempDir({ prefix: 'skmtc-cli-smoke-' })

  const projectPath = join(tempDir, '.skmtc', PROJECT_NAME)
  const settingsPath = join(projectPath, '.settings')

  await Deno.mkdir(settingsPath, { recursive: true })

  await Deno.writeTextFile(join(projectPath, 'deno.json'), FIXTURE_DENO_JSON)
  await Deno.writeTextFile(join(projectPath, 'worker.ts'), FIXTURE_WORKER)
  await Deno.writeTextFile(join(settingsPath, 'client.json'), FIXTURE_CLIENT_JSON)

  // Build bundle.js from worker.ts so the host-side worker loader has
  // something to spawn.
  const bundleCmd = new Deno.Command('deno', {
    args: ['bundle', '-o', 'bundle.js', 'worker.ts'],
    cwd: projectPath,
    stdout: 'piped',
    stderr: 'piped'
  })
  const bundleOut = await bundleCmd.output()
  if (!bundleOut.success) {
    const err = new TextDecoder().decode(bundleOut.stderr)
    throw new Error(`bundle build failed: ${err}`)
  }

  const schemaPath = join(tempDir, 'schema.graphql')
  await Deno.writeTextFile(schemaPath, FIXTURE_SDL)

  return { tempDir, schemaPath }
}

const teardown = async (tempDir: string): Promise<void> => {
  await Deno.remove(tempDir, { recursive: true })
}

Deno.test({
  name: 'CLI smoke - graphql schema generates files and surfaces parseIssues',
  // Bundle build + worker spawn dominate the time; allow generous slack.
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { tempDir, schemaPath } = await setup()
    try {
      const cmd = new Deno.Command(Deno.execPath(), {
        args: [
          'run',
          '--allow-all',
          '--config',
          CLI_DENO_JSON,
          CLI_MOD,
          'generate',
          PROJECT_NAME,
          schemaPath
        ],
        cwd: tempDir,
        stdout: 'piped',
        stderr: 'piped'
      })
      const { success, stdout, stderr } = await cmd.output()

      const out = new TextDecoder().decode(stdout)
      const err = new TextDecoder().decode(stderr)

      if (!success) {
        throw new Error(`CLI failed.\nstdout:\n${out}\nstderr:\n${err}`)
      }

      // Top-line generation summary present.
      assertStringIncludes(out, 'Generated')
      assertStringIncludes(out, 'files in')

      // The fixture schema has 3 distinct issue categories — one of each
      // exercises a different code path in GqlParseContext.
      assertStringIncludes(out, 'Parse issues')
      assertStringIncludes(out, 'DROPPED_DIRECTIVE')
      assertStringIncludes(out, 'NESTED_LIST_LOSSY')
      assertStringIncludes(out, 'SKIPPED_FIELD_ARGUMENTS')

      // Specific locations the parser should attribute issues to.
      assertStringIncludes(out, '@auth')
      assertStringIncludes(out, 'User.grid')
      assertStringIncludes(out, 'User.posts')
    } finally {
      await teardown(tempDir)
    }
  }
})

Deno.test({
  name: 'CLI smoke - clean graphql schema produces no parse issues',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { tempDir, schemaPath } = await setup()
    try {
      // Overwrite with a clean schema (no directives, no nested lists,
      // no non-root field args).
      await Deno.writeTextFile(
        schemaPath,
        /* GraphQL */ `
          type User {
            id: ID!
            name: String!
          }
          type Query {
            me: User!
          }
        `
      )

      const cmd = new Deno.Command(Deno.execPath(), {
        args: [
          'run',
          '--allow-all',
          '--config',
          CLI_DENO_JSON,
          CLI_MOD,
          'generate',
          PROJECT_NAME,
          schemaPath
        ],
        cwd: tempDir,
        stdout: 'piped',
        stderr: 'piped'
      })
      const { success, stdout, stderr } = await cmd.output()

      const out = new TextDecoder().decode(stdout)
      const err = new TextDecoder().decode(stderr)

      if (!success) {
        throw new Error(`CLI failed.\nstdout:\n${out}\nstderr:\n${err}`)
      }

      assertStringIncludes(out, 'Generated')
      // The "Parse issues" section should NOT appear for a clean schema.
      assertEquals(out.includes('Parse issues'), false)
    } finally {
      await teardown(tempDir)
    }
  }
})
