import { assertEquals } from '@std/assert/equals'
import { ensureDir } from '@std/fs/ensure-dir'
import { join } from '@std/path/join'
import { saveSource } from '@/lib/save-source.ts'

type WithProjectArgs = {
  fileName: string
  config: string | undefined
}

const withProject = async <T>(
  { fileName, config }: WithProjectArgs,
  fn: (projectPath: string, configPath: string) => T
): Promise<T> => {
  const projectPath = await Deno.makeTempDir({ prefix: 'skmtc-save-source-' })
  const configPath = join(projectPath, '.settings', fileName)

  try {
    await ensureDir(join(projectPath, '.settings'))
    if (config !== undefined) await Deno.writeTextFile(configPath, config)

    return fn(projectPath, configPath)
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
}

Deno.test('saveSource - writes source as the first key and keeps the others', async () => {
  const config = JSON.stringify({ settings: { basePath: 'src', enrichments: { a: 1 } } })

  await withProject({ fileName: 'skmtc.config.json', config }, (projectPath, configPath) => {
    const result = saveSource({ projectPath, source: './openapi.json' })

    assertEquals(result, { type: 'saved', source: './openapi.json', configPath })
    assertEquals(
      Deno.readTextFileSync(configPath),
      JSON.stringify(
        { source: './openapi.json', settings: { basePath: 'src', enrichments: { a: 1 } } },
        null,
        2
      )
    )
  })
})

Deno.test('saveSource - replaces a source that was there, and reports no change for the same one', async () => {
  const config = JSON.stringify({ source: './old.json', settings: { basePath: 'src' } })

  await withProject({ fileName: 'skmtc.config.json', config }, (projectPath, configPath) => {
    assertEquals(saveSource({ projectPath, source: 'https://example.com/api.json' }).type, 'saved')
    assertEquals(JSON.parse(Deno.readTextFileSync(configPath)).source, 'https://example.com/api.json')

    const before = Deno.readTextFileSync(configPath)

    assertEquals(saveSource({ projectPath, source: 'https://example.com/api.json' }), {
      type: 'unchanged',
      source: 'https://example.com/api.json',
      configPath
    })
    assertEquals(Deno.readTextFileSync(configPath), before)
  })
})

// The trap: a save that went through the settings schema would rename or
// drop what the owner wrote. A project not yet migrated keeps its file name
// and its `settings.system`.
Deno.test('saveSource - a project on client.json keeps its file and its deprecated keys', async () => {
  const config = JSON.stringify({ settings: { basePath: 'src', system: { allOf: 'latestWins' } } })

  await withProject({ fileName: 'client.json', config }, (projectPath, configPath) => {
    assertEquals(saveSource({ projectPath, source: './openapi.json' }).type, 'saved')
    assertEquals(JSON.parse(Deno.readTextFileSync(configPath)), {
      source: './openapi.json',
      settings: { basePath: 'src', system: { allOf: 'latestWins' } }
    })
  })
})

Deno.test('saveSource - no config file, or one that is not an object, is no-config and writes nothing', async () => {
  await withProject({ fileName: 'skmtc.config.json', config: undefined }, projectPath => {
    assertEquals(saveSource({ projectPath, source: './openapi.json' }).type, 'no-config')
  })

  await withProject({ fileName: 'skmtc.config.json', config: '[]' }, (projectPath, configPath) => {
    assertEquals(saveSource({ projectPath, source: './openapi.json' }).type, 'no-config')
    assertEquals(Deno.readTextFileSync(configPath), '[]')
  })
})
