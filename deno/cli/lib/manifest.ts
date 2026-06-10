import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import { toManifestErrors } from '@/lib/generationStats.ts'
import { ConfigValidationError, parseOrExplain } from '@/lib/parse-or-explain.ts'
import { writeFileSafeDir } from '@/lib/file.ts'

type ConstructorArgs = {
  projectName: string
  contents: ManifestContent | null
}

export class Manifest {
  contents: ManifestContent | null
  projectName: string

  private constructor({ projectName, contents }: ConstructorArgs) {
    this.projectName = projectName
    this.contents = contents
  }

  static toPath(projectName: string) {
    const projectPath = toProjectPath(projectName)

    return join(projectPath, '.settings', 'manifest.json')
  }

  static async exists(projectName: string): Promise<boolean> {
    const path = Manifest.toPath(projectName)

    return await exists(path, { isFile: true })
  }

  async refresh() {
    const hasManifest = await Manifest.exists(this.projectName)

    if (hasManifest) {
      const path = Manifest.toPath(this.projectName)
      this.contents = await readManifestTolerant(path)
    }
  }

  toErrorCount() {
    return toManifestErrors(this.contents?.results ?? {}).length
  }

  static async open(projectName: string): Promise<Manifest> {
    const hasManifest = await Manifest.exists(projectName)

    if (hasManifest) {
      const path = Manifest.toPath(projectName)
      const contents = await readManifestTolerant(path)
      return new Manifest({ projectName, contents })
    } else {
      return new Manifest({ projectName, contents: null })
    }
  }

  /**
   * Open a manifest from an explicit path rather than deriving it from
   * the workspace root. Lets callers (and tests) point at an arbitrary
   * `.settings/manifest.json` without depending on `toRootPath()`'s
   * cwd walk. Tolerant read: a missing/malformed/stale-schema manifest
   * yields `contents: null`.
   */
  static async openFromPath(projectName: string, path: string): Promise<Manifest> {
    const hasManifest = await exists(path, { isFile: true })

    if (hasManifest) {
      const contents = await readManifestTolerant(path)
      return new Manifest({ projectName, contents })
    } else {
      return new Manifest({ projectName, contents: null })
    }
  }

  async write() {
    const path = Manifest.toPath(this.projectName)
    const content = JSON.stringify(this.contents, null, 2)

    await writeFileSafeDir(path, content)
  }
}

/**
 * Reads a manifest from disk, tolerating two failure modes that
 * otherwise abort `SkmtcRoot.open` and block every agent-mode command:
 *
 *   1. **Stale schema.** The manifest on disk was written by an
 *      older/newer `@skmtc/core` whose `manifestContent` shape has
 *      drifted. Validating against the current schema throws; we
 *      treat that the same as a missing manifest (returns `null`)
 *      because the next `generate` run rewrites the file anyway.
 *   2. **Malformed JSON.** A truncated write or hand-edit produces
 *      invalid JSON. Same recovery — `null` and a stderr warning.
 *
 * Hard I/O errors (permission denied, disk full reading) still throw —
 * those aren't recoverable here and the caller should learn about them.
 *
 * The warning is intentionally on **stderr** so callers reading
 * `--json` output on stdout aren't polluted.
 */
const readManifestTolerant = async (path: string): Promise<ManifestContent | null> => {
  let raw: string
  try {
    raw = await Deno.readTextFile(path)
  } catch (error) {
    // Existence was checked upstream; a read failure here is genuinely
    // unexpected and worth surfacing.
    throw error
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Warning: manifest at ${path} contains invalid JSON (${message}); ` +
        `ignoring. The next \`skmtc generate\` run will rewrite it.`
    )
    return null
  }

  try {
    return parseOrExplain(manifestContent, parsedJson, `manifest at ${path}`)
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      // Drop down to a one-line summary so the warning isn't a 30-line
      // wall of valibot issues — full detail is one `--json` cat away
      // for anyone who wants it.
      const firstIssue = error.issues[0]
      const summary = firstIssue ? firstIssue.message : 'schema mismatch'
      console.error(
        `Warning: manifest at ${path} doesn't match the current schema (${summary}); ` +
          `ignoring. The next \`skmtc generate\` run will rewrite it.`
      )
      return null
    }
    throw error
  }
}
