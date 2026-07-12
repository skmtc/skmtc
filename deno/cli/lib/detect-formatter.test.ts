import { assertEquals } from '@std/assert'
import { join } from '@std/path'
import { detectFormatter } from './detect-formatter.ts'

const withTempDir = (test: (dir: string) => void): void => {
  const dir = Deno.makeTempDirSync({ prefix: 'skmtc-detect-formatter-' })
  try {
    test(dir)
  } finally {
    Deno.removeSync(dir, { recursive: true })
  }
}

Deno.test('detectFormatter - prettier config file', () => {
  withTempDir(dir => {
    Deno.writeTextFileSync(join(dir, '.prettierrc'), '{}')
    assertEquals(detectFormatter(dir), {
      tool: 'prettier',
      command: 'npx prettier --write',
      evidence: '.prettierrc'
    })
  })
})

Deno.test('detectFormatter - prettier package.json key', () => {
  withTempDir(dir => {
    Deno.writeTextFileSync(join(dir, 'package.json'), JSON.stringify({ prettier: { semi: false } }))
    assertEquals(detectFormatter(dir)?.tool, 'prettier')
  })
})

Deno.test('detectFormatter - biome config', () => {
  withTempDir(dir => {
    Deno.writeTextFileSync(join(dir, 'biome.json'), '{}')
    assertEquals(detectFormatter(dir)?.tool, 'biome')
  })
})

Deno.test('detectFormatter - oxfmt via package.json devDependency', () => {
  withTempDir(dir => {
    Deno.writeTextFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { oxfmt: '^0.52.0' } })
    )
    assertEquals(detectFormatter(dir), {
      tool: 'oxfmt',
      command: 'npx oxfmt',
      evidence: 'package.json oxfmt dependency'
    })
  })
})

Deno.test('detectFormatter - deno fmt via deno.json', () => {
  withTempDir(dir => {
    Deno.writeTextFileSync(join(dir, 'deno.json'), '{}')
    assertEquals(detectFormatter(dir)?.tool, 'deno fmt')
  })
})

Deno.test('detectFormatter - prettier config wins over oxfmt dependency', () => {
  withTempDir(dir => {
    Deno.writeTextFileSync(join(dir, '.prettierrc.json'), '{}')
    Deno.writeTextFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { oxfmt: '^0.52.0' } })
    )
    assertEquals(detectFormatter(dir)?.tool, 'prettier')
  })
})

Deno.test('detectFormatter - nothing detectable', () => {
  withTempDir(dir => {
    Deno.writeTextFileSync(join(dir, 'package.json'), JSON.stringify({}))
    assertEquals(detectFormatter(dir), undefined)
  })
})

Deno.test('detectFormatter - malformed package.json is tolerated', () => {
  withTempDir(dir => {
    Deno.writeTextFileSync(join(dir, 'package.json'), '{not json')
    assertEquals(detectFormatter(dir), undefined)
  })
})
