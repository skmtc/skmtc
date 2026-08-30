// Regenerate the "generated API reference" appendix in the skills that
// carry one, from `deno doc` over framework source. Run from `deno/`:
//
//   deno run --allow-read --allow-write --allow-run=deno,git .scripts/generate-skill-api-appendix.ts
//
// The appendix is the drift-proof alternative to hand-pasted type
// declarations: `deno doc` output is derived from the same source an
// agent would otherwise dive into, so the appendix cannot say something
// the source does not. Re-running the script is the whole maintenance
// story; a verify-docs check can later regenerate-and-diff to gate CI.

const BEGIN_MARKER = '<!-- api-appendix:begin — GENERATED, do not edit by hand -->'
const END_MARKER = '<!-- api-appendix:end -->'

type AppendixSection = {
  title: string
  intro: string
  files: string[]
}

type Target = {
  skill: string
  /** Sibling file the full appendix is written to — SKILL.md keeps only
   * a generated pointer between the markers. Loaded-context diet: the
   * appendix is opened on demand instead of riding every turn. */
  appendix: string
  sections: AppendixSection[]
}

const targets: Target[] = [
  {
    skill: 'docs/skills/skmtc-lang-kotlin/SKILL.md',
    appendix: 'docs/skills/skmtc-lang-kotlin/appendix.md',
    sections: [
      {
        title: '`@skmtc/lang-kotlin` — the full exported surface',
        intro:
          'Every export of the package, with exact constructor/argument shapes. ' +
          'The prose sections above explain how the pieces compose; this is the ' +
          'complete signature-level truth.',
        files: ['lang-kotlin/mod.ts']
      }
    ]
  }
]

const decoder = new TextDecoder()

const run = async (command: string, args: string[]): Promise<string> => {
  const output = await new Deno.Command(command, {
    args,
    env: { NO_COLOR: '1' },
    stdout: 'piped',
    stderr: 'piped'
  }).output()
  if (!output.success) {
    throw new Error(`${command} ${args.join(' ')} failed: ${decoder.decode(output.stderr)}`)
  }
  return decoder.decode(output.stdout)
}

// deno doc emits ANSI styling even when piped; the appendix is plain text.
const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

// Strip @example blocks from deno doc output. The appendix exists for
// signatures, fields, and doc comments — 30-line JSDoc examples are
// context weight at best, and the TypeSystem.ts ones model consumer-side
// `.type` narrowing the doctrine forbids. An @example line opens a skip
// that runs while lines are blank or indented deeper than the tag.
const stripExamples = (doc: string): string => {
  const kept: string[] = []
  let skipIndent: number | null = null
  for (const line of doc.split('\n')) {
    if (skipIndent !== null) {
      const blank = line.trim() === ''
      const indent = line.length - line.trimStart().length
      if (blank || indent > skipIndent) continue
      skipIndent = null
    }
    const tag = line.match(/^(\s*)@example\b/)
    if (tag) {
      skipIndent = tag[1].length
      continue
    }
    kept.push(line)
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n')
}

const relativizePaths = (text: string, repoRoot: string): string =>
  text.replaceAll(`file://${repoRoot}/`, '')

const repoRoot = (await run('git', ['rev-parse', '--show-toplevel'])).trim()

// `--check` regenerates in memory and compares, writing nothing. It is what
// makes the appendix a gate rather than a habit: `deno doc` output cannot
// disagree with source, so the only way this file drifts is by not being
// regenerated after the source moved.
const checkOnly = Deno.args.includes('--check')

/**
 * The commit the DOCUMENTED SOURCE last moved in — not `HEAD`.
 *
 * HEAD was the wrong provenance twice over. It made the line a lie on any
 * commit that did not touch the package (the appendix was "generated from"
 * a docs typo fix), and it made regenerate-and-diff impossible, because every
 * commit changed the output whether or not the API had.
 */
const shaForFiles = async (files: string[]): Promise<string> => {
  const packages = [...new Set(files.map(file => file.split('/')[0]))]
  return (await run('git', ['log', '-1', '--format=%h', '--', ...packages])).trim()
}

const drifted: string[] = []

for (const target of targets) {
  const sourceSha = await shaForFiles(target.sections.flatMap(section => section.files))
  const sectionBlocks: string[] = []
  for (const section of target.sections) {
    const fileBlocks: string[] = []
    for (const file of section.files) {
      const doc = stripExamples(
        relativizePaths(stripAnsi(await run('deno', ['doc', file])), repoRoot)
      ).trim()
      fileBlocks.push(`### \`${file}\`\n\n\`\`\`text\n${doc}\n\`\`\``)
    }
    sectionBlocks.push([`### ${section.title}`, '', section.intro, '', ...fileBlocks].join('\n'))
  }

  // The full appendix lands in a sibling file, opened on demand.
  const appendixBody = [
    '# Appendix — generated API reference',
    '',
    `> Generated from framework source at \`${sourceSha}\` by`,
    '> `deno run --allow-read --allow-write --allow-run=deno,git .scripts/generate-skill-api-appendix.ts`',
    '> (from `deno/`). **Authoritative** for signatures, fields, and doc',
    '> comments — trust it instead of re-reading package source. JSDoc',
    '> `@example` blocks are stripped at generation. For a symbol not',
    '> listed here, `deno doc <file> <Symbol>` against the framework',
    '> source beats grepping it.',
    '',
    ...sectionBlocks,
    ''
  ].join('\n')

  // SKILL.md keeps a short generated pointer between the same markers,
  // so re-runs stay idempotent and the loaded skill stays light.
  const pointer = [
    BEGIN_MARKER,
    '',
    '## Appendix — generated API reference',
    '',
    'The full `deno doc` surface for the packages this skill covers lives',
    'in [`appendix.md`](appendix.md), in this skill\'s directory —',
    `generated from framework source at \`${sourceSha}\`, signatures and`,
    'field docs only. It is **authoritative**: when the prose above does',
    'not carry the exact constructor or field shape you need, Read (or',
    'grep) `appendix.md` instead of diving into package source. Do not',
    'guess signatures. For a symbol not listed there,',
    '`deno doc <file> <Symbol>` against the framework source beats',
    'grepping it.',
    '',
    END_MARKER
  ].join('\n')

  const skillText = await Deno.readTextFile(target.skill)
  const beginAt = skillText.indexOf(BEGIN_MARKER)
  const endAt = skillText.indexOf(END_MARKER)
  const updated =
    beginAt !== -1 && endAt !== -1
      ? skillText.slice(0, beginAt) + pointer + skillText.slice(endAt + END_MARKER.length)
      : `${skillText.trimEnd()}\n\n${pointer}\n`

  if (checkOnly) {
    const appendixOnDisk = await Deno.readTextFile(target.appendix).catch(() => '')
    if (appendixOnDisk !== appendixBody) drifted.push(target.appendix)
    if (skillText !== updated) drifted.push(target.skill)
    continue
  }

  await Deno.writeTextFile(target.appendix, appendixBody)
  await Deno.writeTextFile(target.skill, updated)
  const fileCount = target.sections.reduce((count, section) => count + section.files.length, 0)
  console.log(
    `${target.skill}: pointer ${beginAt !== -1 ? 'replaced' : 'appended'}; ${target.appendix} written (${fileCount} file(s), sha ${sourceSha})`
  )
}

if (checkOnly) {
  if (drifted.length > 0) {
    console.error(
      `stale generated appendix: ${drifted.join(', ')}\n` +
        'Regenerate with: deno run --allow-read --allow-write --allow-run=deno,git ' +
        '.scripts/generate-skill-api-appendix.ts'
    )
    Deno.exit(1)
  }
  console.log(`appendix check: ${targets.length} target(s) match their source`)
}
