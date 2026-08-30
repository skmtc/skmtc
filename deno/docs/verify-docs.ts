#!/usr/bin/env -S deno run --allow-read --allow-run=deno
/**
 * Mechanical doc/skill-chain sync checks — the regression guard for the
 * drift class the friction reviews keep finding (old C8 → C15: the
 * derivation chain `source → llms.md → SKILL.md → eval corpora` has no
 * sync verification at any link, so each link decays independently).
 *
 * Checks:
 *   1. FACT-ANCHOR SYNC — llms.md's "Read this first" list is
 *      self-consistent (its header's spelled-out number matches the
 *      list length) and each fact's bold lead clause appears somewhere
 *      in the skmtc-generator skill, which leads with the generation
 *      model (§1) rather than mirroring the list. (The OTHER skills
 *      deliberately tune their own fact lists to their audience.)
 *   2. DEAD-MODEL GUARD — affirmative mentions of the superseded 0.7.x
 *      interim language model (`resolveLang`, the entry `lang` field,
 *      `declares no 'lang'`) are banned across the doc surfaces; a
 *      mention is allowed only on a line that marks it as historical
 *      ("no longer", "deleted", "superseded", …).
 *   3. LANG SOURCE↔SKILL SYNC — for each shipped language layer with a
 *      skill, the type vocabulary count, identifier-factory names, and
 *      value-protocol exports in the lang package must all appear in
 *      its skill. Currently a no-op: every non-TypeScript layer is
 *      pre-alpha and their skills are deleted until they ship.
 *   4. DOCS-WRITING TREE SYNC — the docs-writing skill's §3 Diátaxis
 *      mapping names every content directory that exists on disk, and
 *      authoring/ mirrors using/'s subdirectory trio.
 *   5. FILLER-WORD GUARD — "simply"/"easily"/"obviously"/"as of this
 *      writing" (banned by docs-writing §4) must not appear in the
 *      reader-facing tree (using/authoring/reference/concepts/
 *      explanation).
 *   6. CLI COMMAND-SURFACE SYNC — every top-level command registered
 *      in cli/mod.ts is mentioned in the skmtc-cli skill and has a
 *      reference/cli/<command>.md page; every reference/cli page and
 *      every row of the skill's command table names a command that is
 *      still registered.
 *   7. PARSE-ISSUE SYNC — every member of the OasIssueType,
 *      GqlIssueType, and EnrichmentWarningType unions has a `### \`CODE\`` entry in
 *      reference/error-codes.md, every documented code is still in a
 *      union, and every issue level the source emits is documented.
 *   8. CLIENT-SETTINGS SYNC — every key of the clientSettings and
 *      skmtcClientConfig valibot schemas appears in
 *      reference/settings/client-json-schema.md (the page claims
 *      "the complete shape").
 *   9. READER-LINT — internal-provenance guard over the reader-facing
 *      tree (using/authoring/concepts/explanation/reference + root
 *      README.md, CLAUDE.md files excluded). Content that answers
 *      "what did we learn" instead of "what does the reader need" has
 *      a mechanical fingerprint: links into the agent/internal layers
 *      (skills/, friction-log/), notes/ paths, internal ticket ids,
 *      refactor-batch tags, DRAFT banners, the maintainer's name,
 *      code-review citations, file:line citations (cite symbols —
 *      line numbers rot), and unfilled bracket placeholders. Known
 *      pre-existing hits are pinned per file+pattern in
 *      reader-lint-baseline.json; a count above its pin fails
 *      (regression), a count below fails too (ratchet — shrink the
 *      baseline).
 *  10. ORPHAN CHECK — every reader-facing page must be reachable by
 *      following markdown links from the entry points (README.md,
 *      using/README.md, authoring/README.md). A page no journey can
 *      route a reader to is orphaned knowledge. Known orphans are
 *      pinned in reader-lint-baseline.json with the same
 *      regression/ratchet contract.
 *
 *  11. CORE-EXPORT SYNC — every symbol named in the first column of a
 *      reference/api/core-overview.md table row must be a real export
 *      of core/mod.ts (resolved via `deno doc --json`, so wildcard
 *      re-exports count). Catches the rename/delete drift class
 *      (pre-0.8 names like `Definition` surviving in the index).
 *      One-directional by design: the overview is a curated index,
 *      not an exhaustive export list.
 *  12. STOCK-GENERATOR SURFACE SYNC — the three doc surfaces that list
 *      stock generators (root README table, stock-generators
 *      overview catalog, per-generator gen-*.md pages) must agree on
 *      the set.
 *
 *  13. DEAD-LINK CHECK — every relative markdown link in the
 *      reader-facing tree must resolve: `.md` targets must exist on
 *      disk, and directory links must contain a README.md. The orphan
 *      check (10) guards reachability; this guards resolution — a
 *      reachable page can still carry a broken link (the class that
 *      survived until an ad-hoc sweep caught it).
 *
 *   exit 0 — all checks hold.
 *   exit 1 — one or more failed; each failure names file + expectation.
 *
 * Usage:  deno run --allow-read --allow-run=deno deno/docs/verify-docs.ts
 *         deno run --allow-read --allow-write deno/docs/verify-docs.ts \
 *           --update-reader-baseline   # rewrite reader-lint-baseline.json
 *                                      # to the current violation set
 * Companion: `friction-log/verify-catalog.ts` (re-runs the discrepancy
 * catalog's pinned verification commands). CI runs both via
 * `deno task verify-docs`.
 */

import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1'

const docsDir = dirname(fromFileUrl(import.meta.url))
const denoDir = join(docsDir, '..')

let failures = 0

const fail = (message: string): void => {
  failures++
  console.log(`FAIL  ${message}`)
}

const pass = (message: string): void => {
  console.log(`ok    ${message}`)
}

const numberWords: Record<number, string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten'
}

// ---------------------------------------------------------------------
// 1. Fact-anchor sync: llms.md "Read this first" is the canonical
//    fact list (its header word must match its own length). The
//    skmtc-generator skill leads with the generation model instead of
//    mirroring the list, so each fact's bold lead clause (the text
//    before any " — ", trailing period dropped) must appear somewhere
//    in the skill — normalized for markdown markup and whitespace.
// ---------------------------------------------------------------------

type FactList = {
  headerWord: string | undefined
  count: number
  leads: string[]
}

const parseFactList = (text: string, headerPattern: RegExp): FactList | undefined => {
  const lines = text.split('\n')
  const start = lines.findIndex(line => headerPattern.test(line))

  if (start === -1) {
    return undefined
  }

  const headerWord = lines[start]
    .match(new RegExp(`(${Object.values(numberWords).join('|')}) facts`, 'i'))?.[1]
    ?.toLowerCase()

  const items: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break
    if (/^\d+\. \*\*/.test(line)) {
      items.push(line)
    } else if (items.length > 0 && line.trim() !== '') {
      items[items.length - 1] += ` ${line.trim()}`
    }
  }

  const leads = items.map(
    item =>
      item
        .replace(/\s+/g, ' ')
        .match(/\*\*(.+?)\*\*/)?.[1]
        ?.trim() ?? ''
  )

  return { headerWord, count: items.length, leads }
}

const llmsPath = join(docsDir, 'llms.md')
const generatorSkillPath = join(docsDir, 'skills', 'skmtc-generator', 'SKILL.md')

const llmsFacts = parseFactList(await Deno.readTextFile(llmsPath), /^## Read this first/)
const generatorSkillText = await Deno.readTextFile(generatorSkillPath)

const normalizeForAnchor = (text: string): string =>
  text.replace(/[`*]/g, '').replace(/\s+/g, ' ').toLowerCase()

if (!llmsFacts) {
  fail('llms.md: "Read this first" section not found')
} else {
  const expected = numberWords[llmsFacts.count]
  if (llmsFacts.headerWord !== expected) {
    fail(
      `llms.md: header says "${llmsFacts.headerWord ?? '<no number word>'} facts" ` +
        `but the list has ${llmsFacts.count} items (expected "${expected}")`
    )
  } else {
    pass('llms.md: header word matches list length')
  }

  const skillNormalized = normalizeForAnchor(generatorSkillText)
  const missingAnchors = llmsFacts.leads
    .map((lead, index) => ({
      fact: index + 1,
      clause: lead.split(' — ')[0].trim().replace(/\.$/, '')
    }))
    .filter(
      item => item.clause !== '' && !skillNormalized.includes(normalizeForAnchor(item.clause))
    )

  if (missingAnchors.length === 0) {
    pass(
      `fact-anchor sync: all ${llmsFacts.count} llms.md fact lead clauses appear in the generator skill`
    )
  } else {
    for (const item of missingAnchors) {
      fail(
        `fact-anchor drift: llms.md fact ${item.fact} lead clause not found in ` +
          `skmtc-generator SKILL.md — carry it in §1 (the model) or §4 (rules):\n` +
          `  "${item.clause}"`
      )
    }
  }
}

// ---------------------------------------------------------------------
// 2. Dead-model guard: the 0.7.x interim language model must not be
//    described affirmatively anywhere agents read. Mentions are fine on
//    lines that mark the model as historical.
// ---------------------------------------------------------------------

const deadModelPatterns: { name: string; pattern: RegExp }[] = [
  { name: 'resolveLang', pattern: /resolveLang/ },
  { name: 'engine-start lang error', pattern: /declares no 'lang'/ },
  { name: 'required lang field', pattern: /required\*?\*? `lang` field/ },
  {
    name: 'lang declared on the entry',
    pattern: /entry declares (?:a|the generator's) `?lang`?/
  },
  {
    name: 'lang resolved by generatorId',
    pattern: /resolv\w+ (?:it|the language) by `?generatorId`?/
  }
]

const historicalMarkers =
  /no longer|deleted|superseded|unwound|there is no|gone|incorrect|pre-0\.8|0\.7\.x|interim|historical|was the/i

const surfaceFiles: string[] = [llmsPath]

const collect = async (dir: string, suffixes: string[]): Promise<void> => {
  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name)
    if (entry.isDirectory) {
      await collect(path, suffixes)
    } else if (suffixes.some(suffix => entry.name.endsWith(suffix))) {
      surfaceFiles.push(path)
    }
  }
}

await collect(join(docsDir, 'concepts'), ['.md'])
await collect(join(docsDir, 'reference'), ['.md'])
for await (const entry of Deno.readDir(join(docsDir, 'skills'))) {
  if (!entry.isDirectory) continue
  const skillFile = join(docsDir, 'skills', entry.name, 'SKILL.md')
  try {
    await Deno.stat(skillFile)
    surfaceFiles.push(skillFile)
  } catch {
    // skill dir without SKILL.md — nothing to check
  }
}
let deadModelHits = 0
for (const file of surfaceFiles) {
  const lines = (await Deno.readTextFile(file)).split('\n')
  lines.forEach((line, index) => {
    for (const { name, pattern } of deadModelPatterns) {
      if (pattern.test(line) && !historicalMarkers.test(line)) {
        deadModelHits++
        fail(
          `dead-model claim (${name}) without a historical marker: ` +
            `${file.replace(denoDir + '/', '')}:${index + 1}`
        )
      }
    }
  })
}
if (deadModelHits === 0) {
  pass(
    `dead-model guard: no affirmative 0.7.x interim-model claims across ${surfaceFiles.length} files`
  )
}

// ---------------------------------------------------------------------
// 3. lang-<X> source ↔ skill sync — one block per shipped language.
// ---------------------------------------------------------------------

// One entry per shipped language layer with a skill. (The other
// non-TypeScript layers are pre-alpha: their skills were deleted
// 2026-07-07 and each returns here when its layer ships.)
const languageSyncTargets: {
  packageDirectory: string
  skillName: string
  guardPrefix: string
}[] = [
  {
    packageDirectory: 'lang-kotlin',
    skillName: 'skmtc-lang-kotlin',
    guardPrefix: 'isKt'
  },
  {
    packageDirectory: 'lang-typescript',
    skillName: 'skmtc-lang-typescript',
    guardPrefix: 'isTs'
  }
]

for (const { packageDirectory, skillName, guardPrefix } of languageSyncTargets) {
  const skillPath = join(docsDir, 'skills', skillName, 'SKILL.md')
  const skill = await Deno.readTextFile(skillPath)
  const factories = await Deno.readTextFile(
    join(denoDir, packageDirectory, 'src', 'createIdentifier.ts')
  )
  const packageMod = await Deno.readTextFile(join(denoDir, packageDirectory, 'mod.ts'))

  const factoryNames = [
    ...new Set([...factories.matchAll(/export const (create[A-Z]\w+)/g)].map(m => m[1]))
  ]

  const kindWord = numberWords[factoryNames.length]
  if (!skill.includes(`${kindWord} entity kinds`)) {
    fail(
      `${skillName} SKILL.md: expected "${kindWord} entity kinds" ` +
        `(${packageDirectory} exports ${factoryNames.length} identifier factories: ${factoryNames.join(
          ', '
        )})`
    )
  } else {
    pass(
      `${packageDirectory} type vocabulary: skill says "${kindWord} entity kinds" matching ${factoryNames.length} factories`
    )
  }

  for (const factory of factoryNames) {
    if (!skill.includes(factory)) {
      fail(`${skillName} SKILL.md: identifier factory ${factory} is exported but never mentioned`)
    }
  }

  const guardPattern = new RegExp(`\\b(${guardPrefix}[A-Z]\\w+)`, 'g')
  const protocolGuards = [...new Set([...packageMod.matchAll(guardPattern)].map(m => m[1]))]
  for (const guard of protocolGuards) {
    if (!skill.includes(guard)) {
      fail(`${skillName} SKILL.md: value-protocol guard ${guard} is exported but never mentioned`)
    }
  }
  if (protocolGuards.every(guard => skill.includes(guard))) {
    pass(
      `${packageDirectory} protocols: all ${protocolGuards.length} exported guards (${protocolGuards.join(
        ', '
      )}) appear in the skill`
    )
  }
}

// ---------------------------------------------------------------------
// 4. Docs-writing tree sync — the docs-writing skill's §3 parenthetical
//    maps Diátaxis onto this tree's directory names. The v0.1.0 mapping
//    had already drifted (recipes/ existed but wasn't mentioned), so
//    both directions are checked: every content directory on disk is
//    named in the skill, and authoring/ mirrors using/'s trio (the
//    skill claims "same trio").
// ---------------------------------------------------------------------

const docsWritingSkillPath = join(docsDir, 'skills', 'docs-writing', 'SKILL.md')
const docsWritingSkill = await Deno.readTextFile(docsWritingSkillPath)

const listSubdirectories = async (dir: string): Promise<string[]> => {
  const names: string[] = []
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isDirectory) names.push(entry.name)
  }
  return names.sort()
}

const usingSubdirectories = await listSubdirectories(join(docsDir, 'using'))
const authoringSubdirectories = await listSubdirectories(join(docsDir, 'authoring'))

let treeSyncFailures = 0

for (const name of usingSubdirectories) {
  if (!docsWritingSkill.includes(`using/${name}/`)) {
    treeSyncFailures++
    fail(
      `docs-writing SKILL.md: docs/using/${name}/ exists but the §3 tree mapping doesn't name \`using/${name}/\``
    )
  }
}

if (usingSubdirectories.join(',') !== authoringSubdirectories.join(',')) {
  treeSyncFailures++
  fail(
    `docs-writing SKILL.md claims authoring/ mirrors using/'s trio, but ` +
      `using/ has [${usingSubdirectories.join(', ')}] and authoring/ has [${authoringSubdirectories.join(
        ', '
      )}]`
  )
}

for (const name of ['authoring/', 'reference/', 'concepts/', 'explanation/']) {
  if (!docsWritingSkill.includes(`\`${name}\``)) {
    treeSyncFailures++
    fail(`docs-writing SKILL.md: §3 tree mapping doesn't name \`${name}\``)
  }
}

if (treeSyncFailures === 0) {
  pass(
    `docs-writing tree sync: skill names all ${usingSubdirectories.length} using/ subdirectories ` +
      `+ the top-level content dirs; authoring/ mirrors using/`
  )
}

// ---------------------------------------------------------------------
// 5. Filler-word guard — the docs-writing skill (§4) bans "simply",
//    "easily", "obviously", and "as of this writing" as filler that
//    condescends when the step isn't easy for the reader. Enforced
//    zero-tolerance across the reader-facing tree. Deliberately NOT
//    checked: "just" and "currently" — both have too many legitimate
//    uses here ("just-in-time", version-scoped capability statements
//    like "does not currently retry"); those stay a review concern.
//    skills/ is excluded: the docs-writing skill quotes the banned
//    words as counter-examples.
// ---------------------------------------------------------------------

const fillerPattern = /\b(simply|easily|obviously)\b|as of this writing/i

const readerFacingFiles: string[] = []
for (const dir of ['using', 'authoring', 'reference', 'concepts', 'explanation']) {
  const collectMarkdown = async (root: string): Promise<void> => {
    for await (const entry of Deno.readDir(root)) {
      const path = join(root, entry.name)
      if (entry.isDirectory) await collectMarkdown(path)
      else if (entry.name.endsWith('.md')) readerFacingFiles.push(path)
    }
  }
  await collectMarkdown(join(docsDir, dir))
}

let fillerHits = 0
for (const file of readerFacingFiles) {
  const lines = (await Deno.readTextFile(file)).split('\n')
  lines.forEach((line, index) => {
    const match = line.match(fillerPattern)
    if (match) {
      fillerHits++
      fail(
        `filler word "${match[0]}" (banned by docs-writing §4): ` +
          `${file.replace(denoDir + '/', '')}:${index + 1}`
      )
    }
  })
}
if (fillerHits === 0) {
  pass(
    `filler-word guard: no simply/easily/obviously across ${readerFacingFiles.length} reader-facing files`
  )
}

// ---------------------------------------------------------------------
// 6. CLI command-surface sync — cli/mod.ts is the source of truth for
//    the registered command surface. Registrations before the final
//    `await new Command()` chain are nested subcommands (project
//    create/rm, migrate variants); registrations after it are the
//    top-level surface. The per-command reference pages must track it in
//    both directions; the skill instead points the agent at
//    `skmtc --help`, and this check holds that pointer in place.
// ---------------------------------------------------------------------

const cliModText = await Deno.readTextFile(join(denoDir, 'cli', 'mod.ts'))
const rootChainIndex = cliModText.indexOf('await new Command()')

const commandRegistrations = [...cliModText.matchAll(/\.command\('([a-z][a-z-]*)', \w+Command\)/g)]
const topLevelCommands = commandRegistrations
  .filter(match => (match.index ?? 0) > rootChainIndex)
  .map(match => match[1])

if (rootChainIndex === -1 || topLevelCommands.length === 0) {
  fail(
    'cli/mod.ts: could not locate the root `await new Command()` chain — ' +
      'the command-surface parser needs updating'
  )
} else {
  const cliSkillText = await Deno.readTextFile(join(docsDir, 'skills', 'skmtc-cli', 'SKILL.md'))

  let commandSurfaceFailures = 0

  for (const command of topLevelCommands) {
    try {
      await Deno.stat(join(docsDir, 'reference', 'cli', `${command}.md`))
    } catch {
      commandSurfaceFailures++
      fail(`reference/cli/${command}.md: registered command \`${command}\` has no reference page`)
    }
  }

  for await (const entry of Deno.readDir(join(docsDir, 'reference', 'cli'))) {
    if (!entry.name.endsWith('.md') || entry.name === 'overview.md' || entry.name === 'CLAUDE.md')
      continue
    const documented = entry.name.replace(/\.md$/, '')
    if (!topLevelCommands.includes(documented)) {
      commandSurfaceFailures++
      fail(
        `reference/cli/${entry.name}: documents \`${documented}\`, which is not ` +
          `a registered top-level command in cli/mod.ts`
      )
    }
  }

  // The skill deliberately carries NO command table — it sends the agent
  // to `skmtc --help`, which cannot go stale against the installed
  // binary. What must hold is that the instruction is still there: a
  // skill that neither lists the commands nor says where to find them
  // leaves the agent guessing.
  for (const discovery of ['skmtc --help', 'skmtc <cmd> -h']) {
    if (!cliSkillText.includes(discovery)) {
      commandSurfaceFailures++
      fail(
        `skmtc-cli SKILL.md: the skill carries no command table, so it must ` +
          `tell the agent to run \`${discovery}\` — that line is missing`
      )
    }
  }

  if (commandSurfaceFailures === 0) {
    pass(
      `CLI command-surface sync: all ${topLevelCommands.length} registered commands ` +
        `have reference pages, no stale pages, and the skill points at \`skmtc --help\``
    )
  }
}

// ---------------------------------------------------------------------
// 7. Parse-issue sync — the OasIssueType and GqlIssueType unions are
//    the source of truth for issue codes; the levels the source emits
//    are the source of truth for severity levels. error-codes.md
//    claims to be the canonical catalog, so both directions must hold.
// ---------------------------------------------------------------------

const parseUnionMembers = (text: string, typeName: string): string[] => {
  const lines = text.split('\n')
  const start = lines.findIndex(line => line.startsWith(`export type ${typeName} =`))
  if (start === -1) return []

  const members: string[] = []
  for (const line of lines.slice(start + 1)) {
    const member = line.match(/^\s*\| '([A-Z_]+)'/)
    if (!member) break
    members.push(member[1])
  }
  return members
}

const oasIssueMembers = parseUnionMembers(
  await Deno.readTextFile(join(denoDir, 'core', 'context', 'generateTypes.ts')),
  'OasIssueType'
)
const enrichmentWarningMembers = parseUnionMembers(
  await Deno.readTextFile(join(denoDir, 'core', 'enrichments', 'EnrichmentWarning.ts')),
  'EnrichmentWarningType'
)
const parseIssueText = await Deno.readTextFile(join(denoDir, 'core', 'context', 'ParseIssue.ts'))
const gqlIssueMembers = parseUnionMembers(parseIssueText, 'GqlIssueType')

const errorCodesText = await Deno.readTextFile(join(docsDir, 'reference', 'error-codes.md'))

if (oasIssueMembers.length === 0 || gqlIssueMembers.length === 0) {
  fail(
    'issue-type unions: could not parse OasIssueType or GqlIssueType from ' +
      'core — the union parser needs updating'
  )
} else {
  let issueSyncFailures = 0
  const unionMembers = new Set([...oasIssueMembers, ...gqlIssueMembers, ...enrichmentWarningMembers])

  for (const code of unionMembers) {
    if (!errorCodesText.includes(`### \`${code}\``)) {
      issueSyncFailures++
      fail(
        `reference/error-codes.md: issue type ${code} is in the source union ` +
          `but has no \`### ${code}\` entry`
      )
    }
  }

  for (const heading of errorCodesText.matchAll(/^### `([A-Z_]+)`/gm)) {
    if (!unionMembers.has(heading[1])) {
      issueSyncFailures++
      fail(
        `reference/error-codes.md: documents ${heading[1]}, which is in ` +
          `neither OasIssueType nor GqlIssueType`
      )
    }
  }

  const sourceLevels = [
    ...new Set([...parseIssueText.matchAll(/level: '(\w+)'/g)].map(match => match[1]))
  ]
  const levelsSection = errorCodesText.match(/^## Issue levels[\s\S]*?(?=^## )/m)
  for (const level of sourceLevels) {
    if (!levelsSection || !levelsSection[0].includes(`\`${level}\``)) {
      issueSyncFailures++
      fail(
        `reference/error-codes.md "Issue levels": source emits level '${level}' ` +
          `(core/context/ParseIssue.ts) but the section doesn't document it`
      )
    }
  }

  if (issueSyncFailures === 0) {
    pass(
      `parse-issue sync: all ${unionMembers.size} issue codes and ` +
        `${sourceLevels.length} levels match error-codes.md, no stale entries`
    )
  }
}

// ---------------------------------------------------------------------
// 8. Client-settings sync — the clientSettings and skmtcClientConfig
//    valibot schemas in core/types/Settings.ts define the client.json
//    surface. reference/settings/client-json-schema.md claims "the
//    complete shape", so every schema key must appear there (as a
//    `"key"` in a JSONC block or as backticked prose).
// ---------------------------------------------------------------------

const parseSchemaKeys = (text: string, constName: string): string[] => {
  const lines = text.split('\n')
  const start = lines.findIndex(line => line.startsWith(`export const ${constName}`))
  if (start === -1) return []

  const keys: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^\}\)/.test(line)) break
    const key = line.match(/^  (\w+):/)
    if (key) keys.push(key[1])
  }
  return keys
}

const settingsText = await Deno.readTextFile(join(denoDir, 'core', 'types', 'Settings.ts'))
const clientJsonDocText = await Deno.readTextFile(
  join(docsDir, 'reference', 'settings', 'client-json-schema.md')
)

const settingsKeys = parseSchemaKeys(settingsText, 'clientSettings')
const configKeys = parseSchemaKeys(settingsText, 'skmtcClientConfig')

if (settingsKeys.length === 0 || configKeys.length === 0) {
  fail(
    'core/types/Settings.ts: could not parse clientSettings or ' +
      'skmtcClientConfig keys — the schema parser needs updating'
  )
} else {
  let settingsSyncFailures = 0
  for (const [owner, keys] of [
    ['clientSettings', settingsKeys],
    ['skmtcClientConfig', configKeys]
  ] as const) {
    for (const key of keys) {
      const documented =
        clientJsonDocText.includes(`"${key}"`) ||
        clientJsonDocText.includes(`\`${key}\``) ||
        clientJsonDocText.includes(`.${key}\``)
      if (!documented) {
        settingsSyncFailures++
        fail(
          `reference/settings/client-json-schema.md: ${owner} key ` +
            `\`${key}\` (core/types/Settings.ts) is not documented`
        )
      }
    }
  }

  if (settingsSyncFailures === 0) {
    pass(
      `client-settings sync: all ${settingsKeys.length + configKeys.length} ` +
        `schema keys appear in client-json-schema.md`
    )
  }
}

// ---------------------------------------------------------------------
// 9. Reader-lint — internal-provenance guard. The reader-facing tree
//    must not carry internal-engineering artifacts: agent-layer links,
//    private-notes paths, ticket ids, refactor tags, DRAFT banners,
//    the maintainer's name, review citations, file:line citations, or
//    unfilled placeholders. Pre-existing hits are pinned per
//    file+pattern in reader-lint-baseline.json (ratchet: counts may
//    only shrink, and shrinking requires shrinking the baseline too).
// ---------------------------------------------------------------------

type ReaderLintPattern = {
  name: string
  explain: string
  matches: (line: string) => boolean
}

const regexLint = (name: string, explain: string, regex: RegExp): ReaderLintPattern => ({
  name,
  explain,
  matches: line => regex.test(line)
})

// The published skills are reader-facing artifacts — a reader page may
// link to one. Every OTHER skill directory is still an internal layer.
// The plugin manifest is the source of truth for which is which, so the
// two cannot drift apart.
const publishedSkillNames: string[] = JSON.parse(
  await Deno.readTextFile(join(docsDir, 'skills', '.claude-plugin', 'plugin.json'))
).skills.map((path: string) => path.replace(/^\.\//, ''))

// Anything under skills/ — a published skill, an unpublished one, a
// file sitting directly in skills/, or the bare directory link. Only a
// skill directory can be exempt, so the capture is that directory name
// and it is absent for every other form. The name has to end at a path
// separator, the closing paren or an anchor, or `skills/README.md`
// would read as a skill called `README`.
const linkIntoSkills = /\]\((?:\.{1,2}\/)*skills\/(?:([\w-]+)(?=[\/)#]))?/
const linkIntoOtherInternalLayer = /\]\((?:\.{1,2}\/)*(?:friction-log|evals)\//

const readerLintPatterns: ReaderLintPattern[] = [
  {
    name: 'link-to-internal-layer',
    explain:
      'reader page links into an unpublished skill, friction-log/, or evals/ ' +
      '(agent/internal layers)',
    matches: line => {
      if (linkIntoOtherInternalLayer.test(line)) return true
      const intoSkills = line.match(linkIntoSkills)
      if (!intoSkills) return false
      // A link at skills/ itself, or at a file directly inside it, has
      // no skill directory to exempt — always internal.
      return intoSkills[1] === undefined || !publishedSkillNames.includes(intoSkills[1])
    }
  },
  regexLint('notes-path', 'reference to the private notes/ tree', /\bnotes\/[\w-]+\//),
  regexLint('internal-ticket', 'internal ticket id', /#SKM-\d+/),
  regexLint('refactor-batch-tag', 'internal refactor-batch shorthand (F5/F6-style)', /\bF[0-9]\b/),
  regexLint('draft-banner', 'DRAFT banner on a shipped page', /\bDRAFT\b/),
  regexLint('maintainer-name', 'maintainer name in reader-facing prose', /Dmitri/),
  regexLint('corpus-citation', 'code-review evidence citation', /\bcorpus:/),
  regexLint(
    'line-number-citation',
    'file:line citation — line numbers rot; cite symbols',
    /\b[A-Za-z][\w./-]*\.tsx?:\d+/
  ),
  {
    name: 'bracket-placeholder',
    explain: 'unfilled bracket placeholder prose',
    matches: line => /^\[[A-Z]/.test(line.trim()) && !line.includes('](')
  }
]

const readerLintFiles: string[] = [join(docsDir, 'README.md')]
const collectReaderFacing = async (root: string): Promise<void> => {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name)
    if (entry.isDirectory) await collectReaderFacing(path)
    else if (entry.name.endsWith('.md') && entry.name !== 'CLAUDE.md') {
      readerLintFiles.push(path)
    }
  }
}
for (const dir of ['using', 'authoring', 'concepts', 'explanation', 'reference']) {
  await collectReaderFacing(join(docsDir, dir))
}

const toDocsRelative = (path: string): string => path.replace(docsDir + '/', '')

const readerFileTexts = new Map<string, string>()
for (const file of readerLintFiles) {
  readerFileTexts.set(toDocsRelative(file), await Deno.readTextFile(file))
}

const readerLintCounts = new Map<string, number>()
const readerLintFirstHit = new Map<string, string>()
for (const [relPath, text] of readerFileTexts) {
  text.split('\n').forEach((line, index) => {
    for (const pattern of readerLintPatterns) {
      if (pattern.matches(line)) {
        const key = `${relPath}|${pattern.name}`
        readerLintCounts.set(key, (readerLintCounts.get(key) ?? 0) + 1)
        if (!readerLintFirstHit.has(key)) {
          readerLintFirstHit.set(key, `${relPath}:${index + 1}`)
        }
      }
    }
  })
}

// ---------------------------------------------------------------------
// 10. Orphan check — BFS over relative markdown links from the entry
//     points. Directory links (`](using/)`) resolve to the directory's
//     README.md when one exists.
// ---------------------------------------------------------------------

const orphanEntryPoints = ['README.md', 'using/README.md', 'authoring/README.md']

const resolveDocsLink = (fromRelPath: string, target: string): string =>
  join(dirname(join(docsDir, fromRelPath)), target).replace(docsDir + '/', '')

const reachable = new Set<string>()
const queue = orphanEntryPoints.filter(entry => readerFileTexts.has(entry))
for (const entry of queue) reachable.add(entry)

while (queue.length > 0) {
  const current = queue.shift()
  if (current === undefined) break
  const text = readerFileTexts.get(current)
  if (text === undefined) continue

  for (const match of text.matchAll(/\]\(([^)\s]+?)(?:#[^)]*)?\)/g)) {
    const target = match[1]
    if (/^[a-z][a-z+]*:/.test(target)) continue // absolute URL scheme

    const candidates = target.endsWith('.md')
      ? [resolveDocsLink(current, target)]
      : target.endsWith('/')
        ? [resolveDocsLink(current, target + 'README.md')]
        : []

    for (const candidate of candidates) {
      if (readerFileTexts.has(candidate) && !reachable.has(candidate)) {
        reachable.add(candidate)
        queue.push(candidate)
      }
    }
  }
}

const currentOrphans = [...readerFileTexts.keys()].filter(relPath => !reachable.has(relPath)).sort()

// ---------------------------------------------------------------------
// Baseline compare (checks 9 + 10 share reader-lint-baseline.json).
// ---------------------------------------------------------------------

type ReaderLintBaseline = {
  patterns: Record<string, number>
  orphans: string[]
}

const readerBaselinePath = join(docsDir, 'reader-lint-baseline.json')
const updateReaderBaseline = Deno.args.includes('--update-reader-baseline')

if (updateReaderBaseline) {
  const nextBaseline: ReaderLintBaseline = {
    patterns: Object.fromEntries(
      [...readerLintCounts.entries()].sort(([a], [b]) => a.localeCompare(b))
    ),
    orphans: currentOrphans
  }
  await Deno.writeTextFile(readerBaselinePath, JSON.stringify(nextBaseline, null, 2) + '\n')
  pass(
    `reader-lint baseline rewritten: ${readerLintCounts.size} file+pattern pins, ` +
      `${currentOrphans.length} orphan(s) — review the diff before committing`
  )
} else {
  const readerBaseline = await (async (): Promise<ReaderLintBaseline | undefined> => {
    try {
      return JSON.parse(await Deno.readTextFile(readerBaselinePath)) as ReaderLintBaseline
    } catch {
      fail(
        'reader-lint: docs/reader-lint-baseline.json missing or unreadable — ' +
          'regenerate with --update-reader-baseline (needs --allow-write)'
      )
      return undefined
    }
  })()

  if (readerBaseline) {
    const patternExplanations = new Map(
      readerLintPatterns.map(pattern => [pattern.name, pattern.explain])
    )

    const allKeys = new Set([...readerLintCounts.keys(), ...Object.keys(readerBaseline.patterns)])
    const readerLintProblems = [...allKeys].sort().flatMap(key => {
      const current = readerLintCounts.get(key) ?? 0
      const pinned = readerBaseline.patterns[key] ?? 0
      const patternName = key.split('|')[1]

      if (current > pinned) {
        return [
          `reader-lint: ${key} — ${current} hit(s), baseline pins ${pinned} ` +
            `(${patternExplanations.get(patternName) ?? patternName}; ` +
            `first hit ${readerLintFirstHit.get(key) ?? '?'})`
        ]
      }
      if (current < pinned) {
        return [
          `reader-lint ratchet: ${key} — improved to ${current} from ${pinned}; ` +
            `shrink the baseline (rerun with --update-reader-baseline)`
        ]
      }
      return []
    })
    readerLintProblems.forEach(fail)

    if (readerLintProblems.length === 0) {
      pass(
        `reader-lint: no new internal-provenance leaks across ${readerLintFiles.length} ` +
          `reader-facing files (${readerLintCounts.size} baselined pins)`
      )
    }

    const baselinedOrphans = new Set(readerBaseline.orphans)
    const newOrphans = currentOrphans.filter(orphan => !baselinedOrphans.has(orphan))
    const staleOrphanPins = readerBaseline.orphans.filter(
      orphan => !currentOrphans.includes(orphan)
    )

    newOrphans.forEach(orphan =>
      fail(
        `orphan check: ${orphan} is unreachable from the entry points ` +
          `(README.md, using/README.md, authoring/README.md) — link it from a ` +
          `journey or don't ship it`
      )
    )
    staleOrphanPins.forEach(orphan =>
      fail(
        `orphan-check ratchet: ${orphan} is no longer orphaned (or no longer ` +
          `exists); shrink the baseline (rerun with --update-reader-baseline)`
      )
    )

    if (newOrphans.length + staleOrphanPins.length === 0) {
      pass(
        `orphan check: all reachable except ${currentOrphans.length} baselined ` +
          `orphan(s) across ${readerFileTexts.size} pages`
      )
    }
  }
}

/**
 * Symbol names out of `deno doc --json`, walking every `symbols` array so a
 * format shift between deno versions stays survivable. Shared by the
 * core-export check and the appendix-coverage one.
 */
const collectSymbolNames = (value: unknown, into: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectSymbolNames(item, into)
    return
  }
  if (value === null || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  if (Array.isArray(record.symbols)) {
    for (const symbol of record.symbols) {
      const name = (symbol as Record<string, unknown>).name
      if (typeof name === 'string') into.add(name)
    }
  }
  for (const child of Object.values(record)) {
    collectSymbolNames(child, into)
  }
}

// ---------------------------------------------------------------------
// 11. Core-export sync — table-leading symbols in core-overview.md must
//     be real exports of core/mod.ts. `deno doc --json` resolves the
//     wildcard re-exports; the extraction walks every `symbols` array
//     so minor format shifts across deno versions stay survivable.
// ---------------------------------------------------------------------

const coreDocCommand = new Deno.Command("deno", {
  args: ["doc", "--json", join(denoDir, "core", "mod.ts")],
  stdout: "piped",
  stderr: "piped",
});
const coreDocResult = await coreDocCommand.output();

if (!coreDocResult.success) {
  fail(
    "core-export sync: `deno doc --json core/mod.ts` failed — " +
      new TextDecoder().decode(coreDocResult.stderr).slice(0, 200),
  );
} else {
  const coreExports = new Set<string>();
  collectSymbolNames(
    JSON.parse(new TextDecoder().decode(coreDocResult.stdout)),
    coreExports,
  );

  if (coreExports.size === 0) {
    fail(
      "core-export sync: extracted zero symbols from `deno doc --json` — " +
        "the extraction needs updating for this deno version",
    );
  } else {
    const coreOverviewText = await Deno.readTextFile(
      join(docsDir, "reference", "api", "core-overview.md"),
    );
    const staleRows = [
      ...coreOverviewText.matchAll(/^\| `([A-Za-z][A-Za-z0-9_]*)`/gm),
    ]
      .map((match) => match[1])
      .filter((name) => !coreExports.has(name));

    staleRows.forEach((name) =>
      fail(
        `core-export sync: core-overview.md table row names \`${name}\`, ` +
          `which core/mod.ts does not export — rename the row to the ` +
          `current symbol or remove it`,
      )
    );
    if (staleRows.length === 0) {
      pass(
        `core-export sync: all core-overview table symbols exist among ` +
          `${coreExports.size} core/mod.ts exports`,
      );
    }
  }
}

// ---------------------------------------------------------------------
// 12. Stock-generator surface sync — the root README table, the
//     stock-generators overview catalog, and the per-generator pages
//     must list the same generator set.
// ---------------------------------------------------------------------

const rootReadmeText = await Deno.readTextFile(join(docsDir, "README.md"));
const stockOverviewText = await Deno.readTextFile(
  join(docsDir, "reference", "stock-generators", "overview.md"),
);

const readmeGenerators = new Set(
  [...rootReadmeText.matchAll(/^\| `@skmtc\/(gen-[a-z-]+)`/gm)].map((m) =>
    m[1]
  ),
);
const overviewGenerators = new Set(
  [...stockOverviewText.matchAll(/\((gen-[a-z-]+)\.md\)/g)].map((m) => m[1]),
);
const generatorPages = new Set<string>();
for await (
  const entry of Deno.readDir(join(docsDir, "reference", "stock-generators"))
) {
  const match = entry.name.match(/^(gen-[a-z-]+)\.md$/);
  if (match) generatorPages.add(match[1]);
}

const surfaceProblems: string[] = [];
for (const generator of generatorPages) {
  if (!readmeGenerators.has(generator)) {
    surfaceProblems.push(
      `stock-generator sync: ${generator} has a reference page but is ` +
        `missing from the root README stock-generators table`,
    );
  }
  if (!overviewGenerators.has(generator)) {
    surfaceProblems.push(
      `stock-generator sync: ${generator} has a reference page but is ` +
        `missing from stock-generators/overview.md`,
    );
  }
}
for (const generator of readmeGenerators) {
  if (!generatorPages.has(generator)) {
    surfaceProblems.push(
      `stock-generator sync: root README lists ${generator} but ` +
        `reference/stock-generators/${generator}.md does not exist`,
    );
  }
}
for (const generator of overviewGenerators) {
  if (!generatorPages.has(generator)) {
    surfaceProblems.push(
      `stock-generator sync: overview.md links ${generator}.md, which ` +
        `does not exist`,
    );
  }
}

surfaceProblems.forEach(fail);
if (surfaceProblems.length === 0) {
  pass(
    `stock-generator surface sync: README table, overview catalog, and ` +
      `${generatorPages.size} reference pages agree`,
  );
}

// ---------------------------------------------------------------------
// 13. Dead-link check — every relative markdown link in the reader
//     tree must resolve. Reuses the file set loaded for checks 9/10.
// ---------------------------------------------------------------------

const deadLinks: string[] = []
for (const [relPath, text] of readerFileTexts) {
  const lines = text.split("\n")
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\]\(([^)\s]+?)(?:#[^)]*)?\)/g)) {
      const target = match[1]
      if (/^[a-z][a-z+]*:/.test(target)) continue // URL scheme
      if (target.startsWith("#") || target === "") continue // same-page anchor

      const fromDir = dirname(join(docsDir, relPath))
      if (target.endsWith(".md")) {
        try {
          Deno.statSync(join(fromDir, target))
        } catch {
          deadLinks.push(`${relPath}:${index + 1} → ${target}`)
        }
      } else if (target.endsWith("/")) {
        try {
          Deno.statSync(join(fromDir, target, "README.md"))
        } catch {
          deadLinks.push(
            `${relPath}:${index + 1} → ${target} (directory link with no README.md behind it)`,
          )
        }
      }
    }
  })
}

deadLinks.forEach(link => fail(`dead link: ${link}`))
if (deadLinks.length === 0) {
  pass(
    `dead-link check: all relative markdown links resolve across ${readerFileTexts.size} reader-facing files`,
  )
}

// ---------------------------------------------------------------------
// 14. Skills catalogue sync — skills/README.md is the catalogue of what
//     exists and which skills ship. Three sources have to agree: the
//     directories on disk, each SKILL.md's frontmatter, and the plugin
//     manifest that carries the published set. The version column
//     drifted once already — it recorded the generation the content came
//     from while frontmatter recorded the name's own line — so every
//     published cell is compared, not just the membership.
// ---------------------------------------------------------------------

const skillsDir = join(docsDir, 'skills')

type SkillFacts = { name: string; version: string; internal: boolean }

const readSkillFacts = async (directory: string): Promise<SkillFacts | undefined> => {
  let text: string
  try {
    text = await Deno.readTextFile(join(skillsDir, directory, 'SKILL.md'))
  } catch {
    fail(`skills/${directory}/ has no SKILL.md`)
    return undefined
  }
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  return {
    name: frontmatter.match(/^name:\s*(\S+)/m)?.[1] ?? '',
    version: frontmatter.match(/^version:\s*(\S+)/m)?.[1] ?? '',
    internal: /^\s+internal:\s*true$/m.test(frontmatter)
  }
}

const skillDirectories: string[] = []
for await (const entry of Deno.readDir(skillsDir)) {
  if (entry.isDirectory && !entry.name.startsWith('.')) skillDirectories.push(entry.name)
}
skillDirectories.sort()

// A catalogue row in either table: | [`<name>/`](<name>/) | purpose | last cell |
const toCatalogueRows = (block: string): Map<string, string> => {
  const rows = new Map<string, string>()
  for (const line of block.split('\n')) {
    const row = line.match(/^\|\s*\[`([\w-]+)\/`\]\([^)]*\)\s*\|.*\|\s*([^|]*?)\s*\|\s*$/)
    if (row) rows.set(row[1], row[2])
  }
  return rows
}

const skillsReadme = await Deno.readTextFile(join(skillsDir, 'README.md'))
const afterPublished = skillsReadme.split('### Published')[1] ?? ''
const publishedRows = toCatalogueRows(afterPublished.split('### Internal')[0] ?? '')
const internalRows = toCatalogueRows(
  (afterPublished.split('### Internal')[1] ?? '').split('\n## ')[0] ?? ''
)

let catalogueFailures = 0
const catalogueFail = (message: string): void => {
  catalogueFailures++
  fail(message)
}

for (const directory of skillDirectories) {
  const facts = await readSkillFacts(directory)
  if (!facts) {
    catalogueFailures++
    continue
  }

  if (facts.name !== directory) {
    catalogueFail(
      `skills/${directory}/SKILL.md: frontmatter name is \`${facts.name}\` — a skill is loaded by ` +
        `directory name, so the two cannot differ`
    )
  }

  const published = publishedSkillNames.includes(directory)
  if (published && facts.internal) {
    catalogueFail(
      `${directory} is listed in plugin.json but carries metadata.internal: true — ` +
        `\`npx skills\` would hide a published skill`
    )
  }
  if (!published && !facts.internal) {
    catalogueFail(
      `${directory} is not in plugin.json and does not carry metadata.internal: true — ` +
        `\`npx skills add skmtc/skmtc\` would list an unpublished skill`
    )
  }

  const row = published ? publishedRows.get(directory) : internalRows.get(directory)
  if (row === undefined) {
    catalogueFail(
      `skills/README.md: ${directory} has no row in the ${published ? 'Published' : 'Internal'} table`
    )
  } else if (published && row !== facts.version) {
    catalogueFail(
      `skills/README.md: the ${directory} row says version ${row}, frontmatter says ` +
        `${facts.version} — the version belongs to the public name, not to the generation ` +
        `the content came from`
    )
  }
}

for (const listed of [...publishedRows.keys(), ...internalRows.keys()]) {
  if (!skillDirectories.includes(listed)) {
    catalogueFail(`skills/README.md lists ${listed}/, which is not a directory under skills/`)
  }
}

for (const name of publishedSkillNames) {
  if (!skillDirectories.includes(name)) {
    catalogueFail(`plugin.json ships ${name}, which is not a directory under skills/`)
  }
}

if (catalogueFailures === 0) {
  pass(
    `skills catalogue: ${skillDirectories.length} skills, ${publishedSkillNames.length} published ` +
      `(names, versions, internal flags and README rows all agree)`
  )
}

// ---------------------------------------------------------------------
// 15. Generated-appendix coverage — every symbol the documented package
//     exports has to appear in its appendix, or the appendix was not
//     regenerated after the API moved.
//
//     NOT a regenerate-and-diff: `deno doc`'s FORMATTING shifts between
//     patch releases, so comparing generated text fails CI whenever its
//     deno is a patch ahead of the author's, on content that is
//     perfectly current. Symbol NAMES come from source, so they are the
//     part worth holding — the same reasoning as check 11.
//
//     `generate-skill-api-appendix.ts --check` still does the exact
//     comparison for an author on one machine, where the deno version
//     is by definition the one that wrote the file.
// ---------------------------------------------------------------------

const appendixTargets = [{ packageDirectory: 'lang-kotlin', skillName: 'skmtc-lang-kotlin' }]

const appendicesOnDisk: string[] = []
for (const directory of skillDirectories) {
  const path = join(skillsDir, directory, 'appendix.md')
  if (await Deno.stat(path).then(() => true, () => false)) appendicesOnDisk.push(directory)
}

for (const orphan of appendicesOnDisk) {
  if (!appendixTargets.some(target => target.skillName === orphan)) {
    fail(`${orphan} ships an appendix.md that no appendix target covers — add it to appendixTargets`)
  }
}

for (const { packageDirectory, skillName } of appendixTargets) {
  const docResult = await new Deno.Command('deno', {
    args: ['doc', '--json', join(denoDir, packageDirectory, 'mod.ts')],
    stdout: 'piped',
    stderr: 'piped'
  }).output()

  if (!docResult.success) {
    fail(
      `appendix coverage: \`deno doc --json ${packageDirectory}/mod.ts\` failed — ` +
        new TextDecoder().decode(docResult.stderr).slice(0, 200)
    )
    continue
  }

  const exported = new Set<string>()
  collectSymbolNames(JSON.parse(new TextDecoder().decode(docResult.stdout)), exported)

  if (exported.size === 0) {
    fail(
      `appendix coverage: extracted zero symbols from ${packageDirectory}/mod.ts — ` +
        'the extraction needs updating for this deno version'
    )
    continue
  }

  const appendix = await Deno.readTextFile(join(skillsDir, skillName, 'appendix.md'))
  const missing = [...exported].filter(name => !appendix.includes(name)).sort()

  if (missing.length > 0) {
    fail(
      `appendix coverage: ${skillName}/appendix.md is missing ${missing.length} of ` +
        `${exported.size} ${packageDirectory} exports (${missing.slice(0, 5).join(', ')}` +
        `${missing.length > 5 ? ', …' : ''}). Regenerate: deno run --allow-read --allow-write ` +
        '--allow-env --allow-run=deno,git .scripts/generate-skill-api-appendix.ts'
    )
  } else {
    pass(
      `appendix coverage: all ${exported.size} ${packageDirectory} exports appear in ` +
        `${skillName}/appendix.md`
    )
  }
}

// ---------------------------------------------------------------------
// 16. Declared-version sync — the check the mechanical guards cannot
//     make. Every check above catches a RENAMED export; none catches a
//     changed RULE that keeps every name — a default flipped, a
//     protocol reordered, a step that became required. So each
//     published skill declares the package minor it was written
//     against, and a workspace that has moved past it fails here. The
//     fix is not editing the number: it is rereading the skill against
//     the package's diff, then editing the number.
// ---------------------------------------------------------------------

const workspaceVersions = new Map<string, { version: string; directory: string }>()
for await (const entry of Deno.readDir(denoDir)) {
  if (!entry.isDirectory || entry.name.startsWith('.')) continue
  const denoJsonPath = join(denoDir, entry.name, 'deno.json')
  const denoJson = await Deno.readTextFile(denoJsonPath).catch(() => undefined)
  if (!denoJson) continue
  const { name, version } = JSON.parse(denoJson)
  if (typeof name === 'string' && typeof version === 'string') {
    workspaceVersions.set(name, { version, directory: entry.name })
  }
}

const toMinor = (version: string): string => version.split('.').slice(0, 2).join('.')

let declaredVersionFailures = 0
let declarationCount = 0

for (const directory of skillDirectories) {
  const skillText = await Deno.readTextFile(join(skillsDir, directory, 'SKILL.md')).catch(() => '')
  const describes = skillText.match(/^ {2}describes:\n((?: {4}'[^']+': '[^']+'\n)+)/m)
  if (!describes) continue

  for (const line of describes[1].trim().split('\n')) {
    const declared = line.match(/'([^']+)': '([^']+)'/)
    if (!declared) continue
    declarationCount++
    const [, packageName, declaredMinor] = declared
    const workspace = workspaceVersions.get(packageName)
    if (!workspace) {
      declaredVersionFailures++
      fail(`${directory} declares ${packageName}, which is not a workspace package`)
      continue
    }
    if (toMinor(workspace.version) !== declaredMinor) {
      declaredVersionFailures++
      fail(
        `${directory} was written against ${packageName} ${declaredMinor}, and the workspace is ` +
          `on ${workspace.version}. Reread the skill against \`git log ${workspace.directory}\` ` +
          `since that minor, then update metadata.describes — the number is the record that ` +
          `someone looked.`
      )
    }
  }
}

if (declaredVersionFailures === 0) {
  pass(
    `declared-version sync: ${declarationCount} skill declaration(s) match the workspace minors`
  )
}

// ---------------------------------------------------------------------
// 17. One install source — the skill install lines live in the repo
//     README and nowhere else. A second copy is not a duplication
//     problem, it is a correctness one: the two drift, and the reader
//     who finds the stale copy has no way to tell which is current.
//     (The published site renders its own copy from a component; it is
//     a different medium, not a second place to edit prose.)
// ---------------------------------------------------------------------

const INSTALL_LINE = 'npx skills add skmtc/skmtc'
const installSources: string[] = []

const rootReadme = join(denoDir, '..', 'README.md')
if ((await Deno.readTextFile(rootReadme)).includes(INSTALL_LINE)) {
  installSources.push('README.md')
}

for (const [relPath, text] of readerFileTexts) {
  if (text.includes(INSTALL_LINE)) installSources.push(relPath)
}

if (installSources.length === 1 && installSources[0] === 'README.md') {
  pass('install source: the skill install lines appear in README.md and nowhere else')
} else if (installSources.length === 0) {
  fail(`install source: no file carries \`${INSTALL_LINE}\` — the README section is the one place it belongs`)
} else {
  fail(
    `install source: the install lines appear in ${installSources.length} files ` +
      `(${installSources.join(', ')}). Keep them in README.md and link to that section.`
  )
}

// ---------------------------------------------------------------------

console.log(`\n${failures === 0 ? 'All doc-sync checks hold.' : `${failures} check(s) failed.`}`)
Deno.exit(failures > 0 ? 1 : 0)
