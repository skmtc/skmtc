import { toGenerateLocalArgs } from '@/lib/to-generate-local-args.ts'
import { printGenerateResult } from '@/lib/print-generate-result.ts'
import {
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import { toManifestPath } from '@/lib/to-manifest-path.ts'
import { toProjectPath } from '@/lib/to-project-path.ts'

type GenerateSwitchArgs = {
  projectName: string
  schemaSourceString: string | undefined
  watch: boolean | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
}

export const generateSwitch = async ({
  projectName,
  schemaSourceString,
  watch,
  jsonFlag,
  noInputFlag
}: GenerateSwitchArgs) => {
  // --json + --watch is incompatible: --json emits a single object
  // and exits, --watch is a stream. Fail loudly so the caller learns
  // to pick one.
  if (jsonFlag && watch) {
    console.error(
      'Error: --json and --watch are mutually exclusive.\n\n' +
        '--json emits a single structured result and exits; --watch is\n' +
        'a long-running stream. Pick one:\n' +
        '  - One-shot agent run: drop --watch\n' +
        '  - Watch loop: drop --json (plain-text summaries per cycle)'
    )
    Deno.exit(2)
  }

  const mode = resolveInputMode({ noInputFlag, jsonFlag })
  const generateLocalArgs = await toGenerateLocalArgs({ projectName, schemaSourceString, watch })

  // Strict mode and `toGenerateLocalArgs` couldn't resolve everything
  // (no schema source given, none in `client.json#source`, or the
  // bundle / project state is missing). The Ink fallback exists for
  // human exploration — for agents we'd rather emit a recipe error
  // pointing at the missing input than mount a TUI they can't drive.
  if (mode === 'strict' && !generateLocalArgs) {
    return failWithRecipe({
      command: 'generate',
      arg: '<schema>',
      usage: 'skmtc generate <project> [schema]',
      example: 'skmtc generate my-api ./schema.json',
      discover:
        'If you want the schema source pinned, set `settings.source` in ' +
        '.skmtc/<project>/.settings/client.json — then `skmtc generate <project>` ' +
        'is enough.'
    })
  }

  if (generateLocalArgs) {
    const { generateLocal } = await import('@/lib/generate-local.ts')
    const result = await generateLocal(generateLocalArgs)

    // Both `--json` and a non-TTY shell route to the structured path;
    // the Ink-free generate flow already wrote plain text, so for
    // strict-mode we just pick the format (text vs JSON) and reuse
    // the existing summary builder.
    const format = mode === 'strict' ? resolveOutputFormat({ jsonFlag }) : 'text'

    printGenerateResult({
      result,
      projectName,
      basePath: generateLocalArgs.clientSettings?.basePath,
      manifestPath: toManifestPath(toProjectPath(projectName)),
      format
    })

    // If any parseIssue came back at `error` level, the run isn't a
    // success even when the JSON payload has `kind: "generated"`.
    // Core's CoreContext catches top-level failures and synthesises
    // an INVALID_SCHEMA error so this branch can detect them — see
    // `core/context/CoreContext.ts` around the toArtifacts catch.
    //
    // `?? []` covers the case where the project's bundle.js is from
    // an older `@skmtc/core` that didn't yet emit `parseIssues` —
    // the field is then `undefined`, and `.some()` on undefined
    // would throw. Treating "no parseIssues field" as "no error
    // issues" matches the original silent-success behaviour for old
    // bundles; new bundles populate the field and get the proper
    // exit-1 signal.
    const fatalParseIssue = (result.parseIssues ?? []).some(
      issue => issue.level === 'error'
    )
    Deno.exit(fatalParseIssue ? 1 : 0)
  }

  // Interactive mode + no resolvable args → mount Ink for the user
  // to fill in the gaps.
  const { renderGenerate } = await import('@/commands/generate.tsx')
  return await renderGenerate({ projectName, schemaSourceString, watch })
}
