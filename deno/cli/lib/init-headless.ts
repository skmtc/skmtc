/**
 * Headless `init` path — creates the `.skmtc/<project>/` scaffolding
 * (`deno.json`, `.settings/skmtc.config.json`) without any Ink rendering.
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
import { hasParentSegment, isAbsolutePath } from '@skmtc/core'

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
 * Validates `basePath` against the conventions documented in
 * `skmtc guide model`. Returns the basePath unchanged on success;
 * throws `InvalidBasePathError` with a caller-actionable message
 * otherwise.
 *
 * The rules are those of core's settings schema, so that a basePath
 * `init` writes is one every later command reads: no absolute path (see
 * friction #13), and no `..` segment. Other rules (e.g. "must resolve
 * to the consumer app's `@` alias root") are conventions documented in that topic but not enforceable
 * here because the consumer's bundler config isn't visible.
 */
export const validateBasePath = (basePath: string): string => {
  if (isAbsolutePath(basePath)) {
    throw new InvalidBasePathError(
      basePath,
      `basePath must be relative to the SKMTC root (the directory containing .skmtc/). Got an absolute path: ${basePath}`
    )
  }
  if (hasParentSegment(basePath)) {
    throw new InvalidBasePathError(
      basePath,
      `basePath must be a forward path with no ".." segments: it is the folder below the SKMTC root (the directory containing .skmtc/) that every generated file sits below. Got: ${basePath}`
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

  // A folder that did not load exists too: creating over it would rewrite its files.
  if (skmtcRoot.toProjectNames().includes(projectName)) {
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
