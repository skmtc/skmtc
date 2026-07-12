/**
 * Headless `init` path — creates the `.skmtc/<project>/` scaffolding
 * (`deno.json`, `.settings/client.json`) without any Ink rendering.
 * Strict mode invokes this directly.
 *
 * Three outcomes are possible:
 *   - `created` — fresh scaffolding written.
 *   - `existed` — the project directory already exists; no-op, surface
 *     it so the caller can see we didn't clobber anything.
 *   - (validation failures) — thrown as `InvalidBasePathError`, caught
 *     in `commands/init.tsx` and converted to a recipe error.
 *
 * `basePath` validation closes friction #13 (absolute paths were
 * silently concatenated onto the SKMTC root, producing artifacts in
 * `<skmtc-root>/<absolute-path>/...`). Absolute paths now fail loudly
 * with a recipe pointing at the relative-path convention.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { isAbsolute } from '@std/path/is-absolute'

type InitHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  basePath: string
}

export type InitHeadlessResult =
  | { type: 'created'; projectName: string; basePath: string }
  | { type: 'existed'; projectName: string }

export class InvalidBasePathError extends Error {
  constructor(
    public readonly basePath: string,
    message: string
  ) {
    super(message)
    this.name = 'InvalidBasePathError'
  }
}

/**
 * Validates `basePath` against the conventions documented in the
 * `skmtc-cli` skill (§1, §6 footnote on §24). Returns the basePath
 * unchanged on success; throws `InvalidBasePathError` with a
 * caller-actionable message otherwise.
 *
 * The single rule today is "no absolute paths" — see friction #13.
 * Other rules (e.g. "must resolve to the consumer app's `@` alias
 * root") are conventions documented in the skill but not enforceable
 * here because the consumer's bundler config isn't visible.
 */
export const validateBasePath = (basePath: string): string => {
  if (isAbsolute(basePath)) {
    throw new InvalidBasePathError(
      basePath,
      `basePath must be relative to the SKMTC root (the directory containing .skmtc/). Got an absolute path: ${basePath}`
    )
  }
  return basePath
}

export const initHeadless = async ({
  skmtcRoot,
  projectName,
  basePath
}: InitHeadlessArgs): Promise<InitHeadlessResult> => {
  validateBasePath(basePath)

  const existing = skmtcRoot.projects.find(p => p.name === projectName)
  if (existing) {
    return { type: 'existed', projectName }
  }

  await skmtcRoot.createProject({
    name: projectName,
    basePath,
    generators: [],
    availableGenerators: []
  })

  return { type: 'created', projectName, basePath }
}
