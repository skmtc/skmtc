/**
 * The digest of the published skills, shared by the bump script and the
 * verify-docs check that gates it.
 *
 * Claude Code updates a plugin when its `version` moves, so a skill edit that
 * ships without a bump reaches nobody. Making the release bump it cannot work:
 * the publish job checks out shallow and read-only, so the write is discarded
 * with the runner. The bump therefore belongs in the PR that edits the skill,
 * and this digest is what forces it — content, not git history, so it answers
 * the same in a shallow clone, a hook, and CI.
 */

import { join } from 'jsr:@std/path@^1'

/** Every file under a skill directory, relative to `skillsDir`, sorted. */
const filesUnder = async (skillsDir: string, directory: string): Promise<string[]> => {
  const found: string[] = []
  const walk = async (relative: string): Promise<void> => {
    for await (const entry of Deno.readDir(join(skillsDir, relative))) {
      if (entry.name.startsWith('.')) continue
      const path = `${relative}/${entry.name}`
      if (entry.isDirectory) await walk(path)
      else found.push(path)
    }
  }
  await walk(directory)
  return found.sort()
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
  const bytes = new TextEncoder().encode(parts.join('\0'))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const hex = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `sha256:${hex}`
}

/** The published set, from the manifest that ships it. */
export const readPublishedNames = async (skillsDir: string): Promise<string[]> => {
  const manifest = JSON.parse(
    await Deno.readTextFile(join(skillsDir, '.claude-plugin', 'plugin.json'))
  )
  return manifest.skills.map((path: string) => path.replace(/^\.\//, ''))
}
