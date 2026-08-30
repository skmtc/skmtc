/**
 * The digest of the published skills, shared by the bump script and the
 * verify-docs check that gates it.
 *
 * Claude Code updates a plugin when its `version` moves, so a skill edit that
 * ships without a bump reaches nobody. Making the release bump it cannot work:
 * the publish job checks out shallow and read-only, so the write is discarded
 * with the runner. The bump therefore belongs in the PR that edits the skill,
 * and this digest is what forces it.
 *
 * The digest covers what an install DELIVERS: the files of every published
 * skill, plus the plugin manifest that ships with them.
 *
 * Changing what goes into the digest changes its value without anything
 * shipping differently, so re-record `plugin-release.json` in the same commit
 * and leave the version where it is.
 */

import { join } from 'jsr:@std/path@^1'
import { runGit } from './run-git.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const exists = async (path: string): Promise<boolean> => {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Every project file under a skill directory, relative to `skillsDir`, sorted.
 *
 * The list comes from git rather than from a directory walk. What an install
 * delivers is what the repository carries, so a scratch file or an editor
 * backup left in a skill directory must not read as a skill edit, and a
 * shipped dotfile must not be invisible to the digest — a walk got both
 * backwards. `--cached` is the index, which a shallow clone carries in full.
 *
 * Contents are read from disk, so editing a tracked file moves the digest at
 * once. A file NEW to the tree counts from the moment it is staged, which is
 * always true at the gates that matter: the pre-push hook and CI both run on
 * committed state.
 *
 * `--cached` still lists a tracked file deleted from the working tree, so
 * paths are filtered by existence and a deletion moves the digest too.
 */
const filesUnder = async (skillsDir: string, directory: string): Promise<string[]> => {
  const listed = await runGit(skillsDir, ['ls-files', '--cached', '-z', '--', directory])

  const paths = listed.split('\0').filter(path => path.length > 0)
  const present = await Promise.all(paths.map(path => exists(join(skillsDir, path))))

  return paths.filter((_path, index) => present[index]).sort()
}

/**
 * The manifest as it ships, with `version` removed.
 *
 * Its description and keywords are what a reader sees in the catalogue, so an
 * edit there reaches nobody without a bump exactly as a skill edit does.
 * `version` is the field the digest exists to move: hashing it would mean no
 * bump could ever settle. Re-serializing means reformatting the file is not
 * an edit.
 */
const manifestWithoutVersion = async (skillsDir: string): Promise<string> => {
  const parsed: unknown = JSON.parse(
    await Deno.readTextFile(join(skillsDir, '.claude-plugin', 'plugin.json'))
  )
  if (!isRecord(parsed)) {
    throw new Error('plugin.json is not a JSON object')
  }
  const { version: _version, ...shipped } = parsed
  return JSON.stringify(shipped, null, 2)
}

/**
 * Names are part of the digest, not just contents: renaming a companion file
 * or adding one changes what an install delivers just as a text edit does.
 */
export const computeSkillsDigest = async (
  skillsDir: string,
  publishedNames: readonly string[]
): Promise<string> => {
  const parts: string[] = []
  for (const name of [...publishedNames].sort()) {
    for (const path of await filesUnder(skillsDir, name)) {
      parts.push(`${path}\n${await Deno.readTextFile(join(skillsDir, path))}`)
    }
  }
  parts.push(`.claude-plugin/plugin.json\n${await manifestWithoutVersion(skillsDir)}`)

  const bytes = new TextEncoder().encode(parts.join('\0'))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const hex = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `sha256:${hex}`
}

/** The published set, from the manifest that ships it. */
export const readPublishedNames = async (skillsDir: string): Promise<string[]> => {
  const manifest: unknown = JSON.parse(
    await Deno.readTextFile(join(skillsDir, '.claude-plugin', 'plugin.json'))
  )
  if (!isRecord(manifest) || !Array.isArray(manifest.skills)) {
    throw new Error('plugin.json has no `skills` array')
  }
  return manifest.skills.map(entry => {
    if (typeof entry !== 'string') {
      throw new Error(`plugin.json skills entry is not a string: ${JSON.stringify(entry)}`)
    }
    return entry.replace(/^\.\//, '')
  })
}
