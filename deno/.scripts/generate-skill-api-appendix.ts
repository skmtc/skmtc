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

type Target = {
  skill: string
  title: string
  intro: string
  files: string[]
}

const targets: Target[] = [
  {
    skill: 'docs/skills/skmtc-lang-kotlin/SKILL.md',
    title: '`@skmtc/lang-kotlin` — the full exported surface',
    intro:
      'Every export of the package, with exact constructor/argument shapes. ' +
      'The prose sections above explain how the pieces compose; this is the ' +
      'complete signature-level truth.',
    files: ['lang-kotlin/mod.ts']
  },
  {
    skill: 'docs/skills/skmtc-generator/SKILL.md',
    title: '`@skmtc/core` — the OAS IR a generator reads',
    intro:
      'The schema classes handed to `transform` / projections via ' +
      '`resolveSchemaRefOnce` and friends: every `OasSchema` variant with its ' +
      'exact fields, plus `OasRef`, `CustomValue`, and the discriminator. ' +
      'Wire facts (`readOnly` / `writeOnly` / `format` / `enums` / `default`) ' +
      'live on the concrete variants listed here — narrow with ' +
      '`switch (resolved.type)` and read inside the branch.',
    files: [
      'core/oas/schema/Schema.ts',
      'core/oas/string/String.ts',
      'core/oas/integer/Integer.ts',
      'core/oas/number/Number.ts',
      'core/oas/boolean/Boolean.ts',
      'core/oas/array/Array.ts',
      'core/oas/object/Object.ts',
      'core/oas/union/Union.ts',
      'core/oas/unknown/Unknown.ts',
      'core/oas/ref/Ref.ts',
      'core/oas/discriminator/Discriminator.ts',
      'core/dsl/CustomValue.ts'
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

const relativizePaths = (text: string, repoRoot: string): string =>
  text.replaceAll(`file://${repoRoot}/`, '')

const repoRoot = (await run('git', ['rev-parse', '--show-toplevel'])).trim()
const sourceSha = (await run('git', ['rev-parse', '--short', 'HEAD'])).trim()

for (const target of targets) {
  const sections: string[] = []
  for (const file of target.files) {
    const doc = relativizePaths(stripAnsi(await run('deno', ['doc', file])), repoRoot).trim()
    sections.push(`### \`${file}\`\n\n\`\`\`text\n${doc}\n\`\`\``)
  }

  const appendix = [
    BEGIN_MARKER,
    '',
    '## Appendix — generated API reference',
    '',
    `> Generated from framework source at \`${sourceSha}\` by`,
    '> `deno run --allow-read --allow-write --allow-run=deno,git .scripts/generate-skill-api-appendix.ts`',
    '> (from `deno/`). **Authoritative** for signatures, fields, and doc',
    '> comments — trust it instead of re-reading package source. For a',
    '> symbol not listed here, `deno doc <file> <Symbol>` against the',
    '> framework source beats grepping it.',
    '',
    `### ${target.title}`,
    '',
    target.intro,
    '',
    ...sections,
    '',
    END_MARKER
  ].join('\n')

  const skillText = await Deno.readTextFile(target.skill)
  const beginAt = skillText.indexOf(BEGIN_MARKER)
  const endAt = skillText.indexOf(END_MARKER)
  const updated =
    beginAt !== -1 && endAt !== -1
      ? skillText.slice(0, beginAt) + appendix + skillText.slice(endAt + END_MARKER.length)
      : `${skillText.trimEnd()}\n\n${appendix}\n`
  await Deno.writeTextFile(target.skill, updated)
  console.log(`${target.skill}: appendix ${beginAt !== -1 ? 'replaced' : 'appended'} (${target.files.length} file(s), sha ${sourceSha})`)
}
