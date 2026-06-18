#!/usr/bin/env -S deno run --allow-read
/**
 * Mechanical doc/skill-chain sync checks — the regression guard for the
 * drift class the friction reviews keep finding (old C8 → C15: the
 * derivation chain `source → llms.md → SKILL.md → eval corpora` has no
 * sync verification at any link, so each link decays independently).
 *
 * Checks:
 *   1. FACT-LIST SYNC — the skmtc-generator skill's §1 fact list and
 *      llms.md's "Read this first" list have the same item count, and
 *      each header's spelled-out number matches its own list.
 *      (The OTHER skills deliberately tune their own five-fact lists to
 *      their audience — only the generator skill mirrors llms.md.)
 *   2. DEAD-MODEL GUARD — affirmative mentions of the superseded 0.7.x
 *      interim language model (`resolveLang`, the entry `lang` field,
 *      `declares no 'lang'`) are banned across the doc surfaces; a
 *      mention is allowed only on a line that marks it as historical
 *      ("no longer", "deleted", "superseded", …).
 *   3. LANG-KOTLIN SOURCE↔SKILL SYNC — the kind vocabulary count, the
 *      identifier-factory names, and the value-protocol exports in
 *      `lang-kotlin` source must all appear in the skmtc-lang-kotlin
 *      skill (catches "six-kind" wording and missing-protocol drift).
 *
 *   exit 0 — all checks hold.
 *   exit 1 — one or more failed; each failure names file + expectation.
 *
 * Usage:  deno run --allow-read deno/docs/verify-docs.ts
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
// 1. Fact-list sync: skmtc-generator SKILL.md §1 ↔ llms.md "Read this
//    first". Counts must match, and each header's spelled number must
//    match its own list length.
// ---------------------------------------------------------------------

type FactList = { headerWord: string | undefined; count: number }

const parseFactList = (text: string, headerPattern: RegExp): FactList | undefined => {
  const lines = text.split('\n')
  const start = lines.findIndex(line => headerPattern.test(line))

  if (start === -1) {
    return undefined
  }

  const headerWord = lines[start].match(
    new RegExp(`(${Object.values(numberWords).join('|')}) facts`, 'i')
  )?.[1]?.toLowerCase()

  let count = 0
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break
    if (/^\d+\. \*\*/.test(line)) count++
  }

  return { headerWord, count }
}

const llmsPath = join(docsDir, 'llms.md')
const generatorSkillPath = join(docsDir, 'skills', 'skmtc-generator', 'SKILL.md')

const llmsFacts = parseFactList(
  await Deno.readTextFile(llmsPath),
  /^## Read this first/
)
const skillFacts = parseFactList(
  await Deno.readTextFile(generatorSkillPath),
  /^## 1\. The \w+ facts/
)

if (!llmsFacts) {
  fail('llms.md: "Read this first" section not found')
} else if (!skillFacts) {
  fail('skmtc-generator SKILL.md: "§1 The <n> facts" section not found')
} else {
  if (llmsFacts.count !== skillFacts.count) {
    fail(
      `fact-list drift: llms.md has ${llmsFacts.count} facts, ` +
        `skmtc-generator SKILL.md §1 has ${skillFacts.count} — re-sync them ` +
        `(the generator skill mirrors llms.md; the other skills tune their own lists)`
    )
  } else {
    pass(`fact-list sync: llms.md and generator skill both list ${llmsFacts.count} facts`)
  }

  for (const [name, facts] of [
    ['llms.md', llmsFacts],
    ['skmtc-generator SKILL.md', skillFacts]
  ] as const) {
    const expected = numberWords[facts.count]
    if (facts.headerWord !== expected) {
      fail(
        `${name}: header says "${facts.headerWord ?? '<no number word>'} facts" ` +
          `but the list has ${facts.count} items (expected "${expected}")`
      )
    } else {
      pass(`${name}: header word matches list length`)
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
  { name: "engine-start lang error", pattern: /declares no 'lang'/ },
  { name: 'required lang field', pattern: /required\*?\*? `lang` field/ },
  { name: 'lang declared on the entry', pattern: /entry declares (?:a|the generator's) `?lang`?/ },
  { name: 'lang resolved by generatorId', pattern: /resolv\w+ (?:it|the language) by `?generatorId`?/ }
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
await collect(join(docsDir, 'skills', 'skmtc-generator', 'eval'), ['.md', '.json'])

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
  pass(`dead-model guard: no affirmative 0.7.x interim-model claims across ${surfaceFiles.length} files`)
}

// ---------------------------------------------------------------------
// 3. lang-<X> source ↔ skill sync — one block per shipped language.
// ---------------------------------------------------------------------

const languageSyncTargets = [
  { packageDirectory: 'lang-kotlin', skillName: 'skmtc-lang-kotlin', guardPrefix: 'isKt' },
  { packageDirectory: 'lang-csharp', skillName: 'skmtc-lang-csharp', guardPrefix: 'isCs' }
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
        `(${packageDirectory} exports ${factoryNames.length} identifier factories: ${factoryNames.join(', ')})`
    )
  } else {
    pass(`${packageDirectory} kind vocabulary: skill says "${kindWord} entity kinds" matching ${factoryNames.length} factories`)
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
    pass(`${packageDirectory} protocols: all ${protocolGuards.length} exported guards (${protocolGuards.join(', ')}) appear in the skill`)
  }
}

// ---------------------------------------------------------------------

console.log(`\n${failures === 0 ? 'All doc-sync checks hold.' : `${failures} check(s) failed.`}`)
Deno.exit(failures > 0 ? 1 : 0)
