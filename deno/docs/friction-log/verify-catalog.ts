#!/usr/bin/env -S deno run --allow-read --allow-run
/**
 * Re-runs every `**Verification command:**` in `discrepancy-catalog.md`
 * against the current source tree.
 *
 * Each catalog entry pinned a doc-vs-source discrepancy with a
 * grep/read verification command. Re-running them all is the
 * regression guard for the 2026-05 docs audit: it catches the catalog
 * *decaying* as source moves, and it is the re-runnable check the
 * audit itself never had.
 *
 *   exit 0 — every verification command still resolves (exit 0).
 *   exit 1 — one or more decayed: the grepped pattern is gone or the
 *            referenced source file was renamed/removed. Re-audit
 *            that entry against current source.
 *
 * Usage:  deno run --allow-read --allow-run \
 *           deno/docs/friction-log/verify-catalog.ts
 *
 * Paths in the verification commands are relative to `deno/`; this
 * script sets that as the working directory, so it can be invoked
 * from anywhere.
 */

import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1'

const scriptDir = dirname(fromFileUrl(import.meta.url))
const catalogPath = join(scriptDir, 'discrepancy-catalog.md')
// `docs/friction-log` → up two → `deno/`, the root the catalog's
// `core/...` verification paths are relative to.
const denoDir = join(scriptDir, '..', '..')

type Entry = { id: string; command: string; fixStatus: string }

const parseEntries = (catalog: string): Entry[] => {
  const entries: Entry[] = []
  for (const section of catalog.split(/^### /m).slice(1)) {
    const id = section.slice(0, section.indexOf('\n')).trim()
    const cmd = section.match(
      /\*\*Verification command:\*\*\s*\n```bash\n([\s\S]*?)\n```/
    )
    if (!cmd) continue
    const fix = section.match(/\*\*Fix status:\*\*\s*(.+)/)
    entries.push({
      id,
      command: cmd[1].trim(),
      fixStatus: fix ? fix[1].trim() : '(none)'
    })
  }
  return entries
}

const entries = parseEntries(await Deno.readTextFile(catalogPath))

if (entries.length === 0) {
  console.error('No verification commands found in discrepancy-catalog.md.')
  Deno.exit(1)
}

let decayed = 0
for (const entry of entries) {
  const { code } = await new Deno.Command('bash', {
    args: ['-c', entry.command],
    cwd: denoDir,
    stdout: 'null',
    stderr: 'null'
  }).output()

  if (code === 0) {
    console.log(`ok       ${entry.id}`)
  } else {
    decayed++
    console.log(`DECAYED  ${entry.id} — verification command exited ${code}`)
    console.log(`         ${entry.command.replace(/\n/g, '\n         ')}`)
  }
}

console.log(`\n${entries.length} checked, ${decayed} decayed.`)
if (decayed > 0) {
  console.log(
    'A decayed entry means its referenced source moved or the grepped\n' +
      'pattern is gone — re-audit that catalog entry against current source.'
  )
}

Deno.exit(decayed > 0 ? 1 : 0)
