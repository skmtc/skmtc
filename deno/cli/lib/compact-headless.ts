/**
 * Headless `client.json` format toggle.
 *
 * Converts a project's `client.json` between the human-readable
 * (pretty-printed) form and the {@link CompactClientJson compact} form —
 * minified, with every string interned into a shared pool. This is a
 * **pure, lossless format transform**: it round-trips the file through the
 * codec (or through expansion + pretty-print) without going through the
 * `skmtcClientConfig` valibot schema, so no keys are dropped and nothing
 * but whitespace/encoding changes.
 *
 * The compact form is ~5–6× smaller than the pretty form on an
 * enrichment-heavy project. See `@skmtc/core/ClientJsonCompact`.
 */

import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import {
  encodeCompact,
  expandClientJson,
  isCompactClientJson
} from '@skmtc/core/ClientJsonCompact'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { writeFileSafeDir } from '@/lib/file.ts'

export type CompactHeadlessResult = {
  projectPath: string
  clientJsonPath: string
  /** `true` when the project has no `client.json` to convert. */
  missing: boolean
  /** The form the file was already in before this run. */
  wasCompact: boolean
  /** The form requested — `true` for compact, `false` for expanded. */
  toCompact: boolean
  /** Whether the file was rewritten (false when it was already in the target form). */
  changed: boolean
  beforeBytes: number
  afterBytes: number
}

type CompactHeadlessArgs = {
  projectName: string
  /** When `true`, restore the expanded (human-readable) form instead. */
  expand: boolean
}

const byteLength = (text: string): number => new TextEncoder().encode(text).length

export const compactHeadless = async ({
  projectName,
  expand
}: CompactHeadlessArgs): Promise<CompactHeadlessResult> => {
  const projectPath = toProjectPath(projectName)
  const clientJsonPath = join(projectPath, '.settings', 'client.json')
  const toCompact = !expand

  if (!existsSync(clientJsonPath)) {
    return {
      projectPath,
      clientJsonPath,
      missing: true,
      wasCompact: false,
      toCompact,
      changed: false,
      beforeBytes: 0,
      afterBytes: 0
    }
  }

  const source = await Deno.readTextFile(clientJsonPath)
  const beforeBytes = byteLength(source)
  const parsedJson = JSON.parse(source)
  const wasCompact = isCompactClientJson(parsedJson)

  // Already in the requested form — nothing to do.
  if (wasCompact === toCompact) {
    return {
      projectPath,
      clientJsonPath,
      missing: false,
      wasCompact,
      toCompact,
      changed: false,
      beforeBytes,
      afterBytes: beforeBytes
    }
  }

  // Expand first so the source form (compact or not) is irrelevant, then
  // re-emit in the requested form. The codec is lossless, so this is a
  // pure format toggle.
  const expanded = expandClientJson(parsedJson)
  const next = toCompact
    ? JSON.stringify(encodeCompact(expanded))
    : JSON.stringify(expanded, null, 2) + '\n'

  await writeFileSafeDir(clientJsonPath, next)

  return {
    projectPath,
    clientJsonPath,
    missing: false,
    wasCompact,
    toCompact,
    changed: true,
    beforeBytes,
    afterBytes: byteLength(next)
  }
}
