import { assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import { pinServerForPublish } from '@/lib/publish-server-pin.ts'
import { readCliServerPin } from '@/lib/doctor-headless.ts'

const withProject = async (
  imports: Record<string, string>,
  run: (projectPath: string) => Promise<void>
): Promise<void> => {
  const projectPath = await Deno.makeTempDir()
  await Deno.writeTextFile(
    join(projectPath, 'deno.json'),
    JSON.stringify({ name: '@acme/my-api', version: '1.0.0', imports })
  )
  try {
    await run(projectPath)
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
}

const readImports = async (projectPath: string): Promise<unknown> =>
  JSON.parse(await Deno.readTextFile(join(projectPath, 'deno.json'))).imports

const wanted = `jsr:@skmtc/server@${readCliServerPin()}`

Deno.test('pinServerForPublish - adds the pin when it is absent', async () => {
  await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.1.0' }, async projectPath => {
    assertEquals(await pinServerForPublish(projectPath), true)
    assertEquals(await readImports(projectPath), {
      '@skmtc/core': 'jsr:@skmtc/core@0.1.0',
      '@skmtc/server': wanted
    })
  })
})

Deno.test('pinServerForPublish - repins an older JSR version to the CLI version', async () => {
  await withProject({ '@skmtc/server': 'jsr:@skmtc/server@0.0.1' }, async projectPath => {
    assertEquals(await pinServerForPublish(projectPath), true)
    assertEquals(await readImports(projectPath), { '@skmtc/server': wanted })
  })
})

Deno.test('pinServerForPublish - leaves the current pin and the file alone', async () => {
  await withProject({ '@skmtc/server': wanted }, async projectPath => {
    const before = await Deno.readTextFile(join(projectPath, 'deno.json'))
    assertEquals(await pinServerForPublish(projectPath), false)
    // No rewrite: the user's formatting survives a no-op publish.
    assertEquals(await Deno.readTextFile(join(projectPath, 'deno.json')), before)
  })
})

Deno.test('pinServerForPublish - keeps a local override of @skmtc/server', async () => {
  await withProject({ '@skmtc/server': '../server/mod.ts' }, async projectPath => {
    assertEquals(await pinServerForPublish(projectPath), false)
    assertEquals(await readImports(projectPath), { '@skmtc/server': '../server/mod.ts' })
  })
})
