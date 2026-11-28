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

Deno.test('saveSource - writes a new source as the first key and keeps the others', async () => {
  const config = JSON.stringify({ settings: { basePath: 'src', enrichments: { a: 1 } } })

  await withProject({ fileName: 'skmtc.config.json', config }, (projectPath, configPath) => {
    const result = saveSource({ projectPath, source: './openapi.json' })

    assertEquals(result, { type: 'saved', source: './openapi.json', configPath })
    // A file on one line stays on one line.
    assertEquals(
      Deno.readTextFileSync(configPath),
      JSON.stringify({ source: './openapi.json', settings: { basePath: 'src', enrichments: { a: 1 } } })
    )
  })
})

// The trap: a save that writes the file in its own style rewrites every
// line of it, and the owner's diff no longer shows the one key that changed.
Deno.test('saveSource - keeps the indent, the trailing newline and the place of source', async () => {
  const config = `{
    "settings": {
        "basePath": "src"
    },
    "source": "./old.json"
}
`

  await withProject({ fileName: 'skmtc.config.json', config }, (projectPath, configPath) => {
    assertEquals(saveSource({ projectPath, source: './new.json' }).type, 'saved')
    assertEquals(Deno.readTextFileSync(configPath), config.replace('./old.json', './new.json'))
  })

  const noNewline = '{\n\t"settings": {\n\t\t"basePath": "src"\n\t}\n}'

  await withProject({ fileName: 'skmtc.config.json', config: noNewline }, (projectPath, configPath) => {
    assertEquals(saveSource({ projectPath, source: './openapi.json' }).type, 'saved')
    assertEquals(
      Deno.readTextFileSync(configPath),
      '{\n\t"source": "./openapi.json",\n\t"settings": {\n\t\t"basePath": "src"\n\t}\n}'
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
