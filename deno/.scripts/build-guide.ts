#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Write `cli/guide/topics.json` from `cli/guide/*.md`: `deno task build-guide`.
 *
 * Run this in the pull request that edits a guide file. verify-docs fails
 * until you do, because the CLI prints `topics.json` and not the Markdown.
 *
 * `--check` reports whether the file is current, and writes nothing.
 */
import { dirname, fromFileUrl, join } from '@std/path'
import { buildGuideTopics, readGuideSources, renderGuideTopics } from './guide-topics.ts'

const guideDir = join(dirname(fromFileUrl(import.meta.url)), '..', 'cli', 'guide')
const topicsPath = join(guideDir, 'topics.json')

const topics = buildGuideTopics(await readGuideSources(guideDir))
const rendered = renderGuideTopics(topics)
const current = await Deno.readTextFile(topicsPath).catch(() => '')

if (current === rendered) {
  console.log(`guide: topics.json holds the ${topics.length} topics of cli/guide/*.md`)
  Deno.exit(0)
}

if (Deno.args.includes('--check')) {
  console.error('guide: cli/guide/topics.json is not what cli/guide/*.md gives')
  Deno.exit(1)
}

await Deno.writeTextFile(topicsPath, rendered)
console.log(`guide: wrote ${topics.length} topics to cli/guide/topics.json`)
