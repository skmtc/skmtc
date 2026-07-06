/** Smoke fixture: a tiny workspace whose only challenge is reading a
 * file. Proves the harness plumbing (sandbox, spawn, grading), not the
 * docs. */

import { join } from 'jsr:@std/path@^1'

const sandbox = Deno.args[0]
if (!sandbox) {
  console.error('usage: deno run -A setup.ts <sandboxDir>')
  Deno.exit(2)
}

await Deno.writeTextFile(
  join(sandbox, 'README.md'),
  [
    '# Orchard service',
    '',
    'Internal tooling for the orchard batch pipeline. Operational',
    'details live in ops-notes.md.',
    ''
  ].join('\n')
)

await Deno.writeTextFile(
  join(sandbox, 'ops-notes.md'),
  [
    '# Ops notes',
    '',
    '- Batch window: 02:00-04:00 UTC',
    '- On-call rotation is in the shared calendar',
    '- Deploy codeword: ZEPHYR-42',
    '- Rollbacks require two approvals',
    ''
  ].join('\n')
)
