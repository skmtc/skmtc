#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run=git
/**
 * Bump the plugin version and re-record the published-skills digest.
 *
 * Run this in the PR that edits a published skill — `deno task bump-plugin`.
 * verify-docs fails until you do, because a skill edit that ships without a
 * version bump reaches no Claude Code user: the plugin only updates when its
 * version moves.
 *
 * `--check` reports whether a bump is needed without writing, which is what the
 * verify-docs check runs.
 *
 * Two PRs that each edit a published skill both compute the same next patch and
 * write it to the same three files, so they conflict on merge. That is the cost
 * of putting the bump in the editing PR, and it is paid the same way as any
 * other conflict: rebase and re-run this.
 */
import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1'
import { computeSkillsDigest, readPublishedNames, readSingleSkillPlugins } from './plugin-digest.ts'

const denoDir = join(dirname(fromFileUrl(import.meta.url)), '..')
const skillsDir = join(denoDir, 'docs', 'skills')
const pluginPath = join(skillsDir, '.claude-plugin', 'plugin.json')
const marketplacePath = join(denoDir, '..', '.claude-plugin', 'marketplace.json')
const recordPath = join(denoDir, '.scripts', 'plugin-release.json')

const checkOnly = Deno.args.includes('--check')

const plugin = JSON.parse(await Deno.readTextFile(pluginPath))
const marketplace = JSON.parse(await Deno.readTextFile(marketplacePath))
const record = JSON.parse(await Deno.readTextFile(recordPath))

const digest = await computeSkillsDigest(skillsDir, await readPublishedNames(skillsDir))

if (digest === record.digest && record.version === plugin.version) {
  console.log(`plugin ${plugin.version}: published skills unchanged since the last bump`)
  Deno.exit(0)
}

if (checkOnly) {
  console.error(
    digest === record.digest
      ? `plugin.json says ${plugin.version}, plugin-release.json records ${record.version}`
      : 'published skills changed since the last plugin bump'
  )
  Deno.exit(1)
}

const parts = String(plugin.version).split('.').map(Number)
if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) {
  console.error(`plugin.json version is not major.minor.patch: ${JSON.stringify(plugin.version)}`)
  Deno.exit(1)
}
const next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`

// The bump goes to the entries that ship from this folder (the plugin.json
// plugin and each single-skill plugin), by name. Any other entry keeps its version.
const singleNames = (await readSingleSkillPlugins(skillsDir)).map(({ entry }) => entry.name)
const bumpedNames = [plugin.name, ...singleNames]
const entries = marketplace.plugins.filter((candidate: { name: string }) =>
  bumpedNames.includes(candidate.name)
)
if (!entries.some((candidate: { name: string }) => candidate.name === plugin.name)) {
  console.error(`marketplace.json has no plugin named ${plugin.name}`)
  Deno.exit(1)
}

plugin.version = next
for (const entry of entries) entry.version = next
await Deno.writeTextFile(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`)
await Deno.writeTextFile(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`)
await Deno.writeTextFile(
  recordPath,
  `${JSON.stringify({ version: next, digest }, null, 2)}\n`
)

console.log(`plugin ${plugin.version} — digest re-recorded; commit these three files`)
