import { assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import { openUrl, toOpenArgs } from '@/lib/open-url.ts'
import { withEnv } from '@/tests/mocks/env.mock.ts'

/** Quotes, `;`, `$(...)` and spaces: each must reach the opener as one argument. */
const HOSTILE_URL = `https://skmtc.dev/acme/apis/pets/settings?linkRequest=a'b";touch pwned;$(touch pwned2) c`

Deno.test('toOpenArgs - the URL is a positional argument, never in the script', () => {
  assertEquals(toOpenArgs(HOSTILE_URL, 'darwin'), ['-c', 'open "$1"', 'sh', HOSTILE_URL])
  assertEquals(toOpenArgs(HOSTILE_URL, 'linux'), ['-c', 'xdg-open "$1"', 'sh', HOSTILE_URL])
  assertEquals(toOpenArgs(HOSTILE_URL, 'windows'), undefined)
})

Deno.test({
  name: 'openUrl - the opener runs once with the URL unchanged as its one argument',
  ignore: Deno.build.os === 'windows',
  fn: async () => {
    const bin = await Deno.realPath(await Deno.makeTempDir())
    const log = join(bin, 'calls')
    const opener = Deno.build.os === 'darwin' ? 'open' : 'xdg-open'
    // A stand-in opener that records its argument count and each argument.
    await Deno.writeTextFile(
      join(bin, opener),
      `#!/bin/sh\nprintf '%s\\n' "$#" >> "${log}"\nfor arg in "$@"; do printf '%s\\n' "$arg" >> "${log}"; done\n`
    )
    await Deno.chmod(join(bin, opener), 0o755)
    const cwd = Deno.cwd()
    // A `touch` the URL smuggled into the script would land here.
    Deno.chdir(bin)
    try {
      const opened = await withEnv({ PATH: `${bin}:${Deno.env.get('PATH') ?? ''}` }, () =>
        openUrl(HOSTILE_URL)
      )

      assertEquals(opened, true)
      assertEquals(await Deno.readTextFile(log), `1\n${HOSTILE_URL}\n`)
      assertEquals(
        [...Deno.readDirSync(bin)].map(entry => entry.name).sort(),
        ['calls', opener].sort()
      )
    } finally {
      Deno.chdir(cwd)
      await Deno.remove(bin, { recursive: true })
    }
  }
})

Deno.test('openUrl - no opener for the platform is not opened, and not an error', async () => {
  assertEquals(await openUrl('https://skmtc.dev/', { os: 'windows' }), false)
})
