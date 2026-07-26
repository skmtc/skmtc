import { assertEquals, assertGreater } from '@std/assert'
import { join } from '@std/path/join'
import { Generator } from '../../../cli/lib/generator.ts'
import { KotlinModelGenerator } from '../../../cli/lib/kotlin-model-generator.ts'
import { ModelGenerator } from '../../../cli/lib/model-generator.ts'
import { OperationGenerator } from '../../../cli/lib/operation-generator.ts'
import { lintAll } from './lint.ts'

/**
 * The scaffold is canon: `skmtc create` writes the shape the doctrine
 * describes, so **the plugin must find nothing in it**. If a rule fires
 * here, either the rule is wrong or the scaffold has drifted — and either
 * way it is a bug, not a style debate.
 *
 * The scaffolders are run for real into a temp directory and their output
 * files are read back, so this test tracks whatever `skmtc create`
 * actually writes rather than a copy of it. (The relative import into the
 * CLI package is test-only; `@skmtc/lint-plugin` declares no dependency on
 * `@skmtc/cli`, and the test files are excluded from publish.)
 */

const toScaffoldFiles = async (
  write: (generatorPath: string) => Promise<void>
): Promise<{ path: string; source: string }[]> => {
  const temp = await Deno.makeTempDir({ prefix: 'skmtc-lint-scaffold-' })
  // The real path shape, `<root>/.skmtc/<project>/<generator>/`, because the
  // rules gate on the filename: a scaffold linted at a path that happened
  // to be out of scope would pass for the wrong reason.
  const root = join(temp, '.skmtc', 'lab', 'gen-thing')
  try {
    await Deno.mkdir(root, { recursive: true })
    await write(root)
    const walk = async (directory: string): Promise<{ path: string; source: string }[]> => {
      const entries = []
      for (const entry of Deno.readDirSync(directory)) {
        const path = join(directory, entry.name)
        entries.push(
          ...(entry.isDirectory
            ? await walk(path)
            : entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')
              ? [{ path, source: await Deno.readTextFile(path) }]
              : [])
        )
      }
      return entries
    }
    return await walk(root)
  } finally {
    await Deno.remove(temp, { recursive: true })
  }
}

const generator = Generator.create({
  projectName: 'lab',
  scopeName: '@lab',
  packageName: 'gen-thing',
  version: '0.0.1'
})

const assertClean = (files: { path: string; source: string }[]): void => {
  assertGreater(files.length, 0)
  const findings = files.flatMap(file =>
    lintAll(file.source, file.path).map(
      diagnostic => `${file.path.split('/').at(-1)}: [${diagnostic.id}] ${diagnostic.message}`
    )
  )
  assertEquals(findings, [])
}

Deno.test('scaffold: the kotlin model generator is clean', async () => {
  assertClean(
    await toScaffoldFiles(path => new KotlinModelGenerator(generator).createModelFiles(path))
  )
})

Deno.test('scaffold: the typescript model generator is clean', async () => {
  assertClean(await toScaffoldFiles(path => new ModelGenerator(generator).createModelFiles(path)))
})

Deno.test('scaffold: the typescript operation generator is clean', async () => {
  assertClean(
    await toScaffoldFiles(path => new OperationGenerator(generator).createOperationFiles(path))
  )
})
