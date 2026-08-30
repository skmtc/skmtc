#!/usr/bin/env -S deno run --allow-read --allow-write
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
 */
import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1'
import { computeSkillsDigest, readPublishedNames } from './plugin-digest.ts'

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

// By name, not by index: a second marketplace entry must not take the bump.
const entry = marketplace.plugins.find((candidate: { name: string }) => candidate.name === plugin.name)
if (!entry) {
  console.error(`marketplace.json has no plugin named ${plugin.name}`)
  Deno.exit(1)
}

plugin.version = next
entry.version = next
await Deno.writeTextFile(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`)
await Deno.writeTextFile(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`)
await Deno.writeTextFile(
  recordPath,
  `${JSON.stringify({ version: next, digest }, null, 2)}\n`
)

console.log(`plugin ${plugin.version} — digest re-recorded; commit these three files`)
