import { toGenerateLocalArgs } from '@/lib/to-generate-local-args.ts'
import { printGenerateResult } from '@/lib/print-generate-result.ts'
import {
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import { toManifestPath } from '@/lib/to-manifest-path.ts'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { checkBundleFreshness } from '@/lib/bundle-freshness.ts'
import { runTypecheck } from '@/lib/typecheck.ts'
import { resolve } from '@std/path'

type GenerateSwitchArgs = {
  projectName: string
  schemaSourceString: string | undefined
  watch: boolean | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
  /**
   * When `true`, run `tsc --noEmit` against the consumer's
   * tsconfig after generating and surface diagnostics scoped to
   * the files this run wrote. Closes friction #10.
   */
  typecheck?: boolean
  /** Optional override for the tsconfig.json path used by `--typecheck`. */
  tsconfig?: string
  /** Optional override for the `tsc` command (default: `npx tsc`). */
  tscCmd?: string
}

export const generateSwitch = async ({
  projectName,
  schemaSourceString,
  watch,
  jsonFlag,
  noInputFlag,
  typecheck,
  tsconfig,
  tscCmd
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
    // Bundle freshness: if `deno.json#imports` and the on-disk
    // `worker.ts` disagree on which generators are present (e.g.
    // someone hand-edited `deno.json` outside the CLI), refuse with
    // a recipe error pointing at `bundle`. Without this, `generate`
    // silently runs against a stale bundle and skips the changed
    // generators — friction #4's defensive net.
    //
    // Only gates strict mode (agents). Interactive users see realtime
    // output and can recover; agents need the upfront refusal.
    if (mode === 'strict') {
      const freshness = checkBundleFreshness({ projectName })
      if (freshness.kind === 'stale' || freshness.kind === 'missing-worker') {
        console.error(`Error: ${freshness.message}\n`)
        if (freshness.kind === 'stale') {
          console.error(`${freshness.hint}\n`)
        }
        Deno.exit(2)
      }
    }

    const { generateLocal } = await import('@/lib/generate-local.ts')
    const result = await generateLocal(generateLocalArgs)

    // Optional post-generate type-check pass. Runs the consumer's
    // tsc against the freshly-emitted files; diagnostics are scoped
    // to this run so unrelated pre-existing errors elsewhere in the
    // consumer app don't pollute the result. Friction #10.
    const typecheckResult = typecheck
      ? await runTypecheck({
          filePaths: result.filePaths,
          basePathAbs: generateLocalArgs.clientSettings?.basePath
            ? resolve(generateLocalArgs.clientSettings.basePath)
            : undefined,
          tsconfigOverride: tsconfig,
          tscCmd
        })
      : undefined

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
      typecheck: typecheckResult,
      format
    })

    // If any parseIssue came back at `error` level, the run isn't a
    // success even when the JSON payload has `kind: "generated"`.
    // Core's CoreContext catches top-level failures and synthesizes
    // an INVALID_SCHEMA error so this branch can detect them — see
    // `core/context/CoreContext.ts` around the toArtifacts catch.
    //
    // `?? []` covers the case where the project's bundle.js is from
    // an older `@skmtc/core` that didn't yet emit `parseIssues` —
    // the field is then `undefined`, and `.some()` on undefined
    // would throw. Treating "no parseIssues field" as "no error
    // issues" matches the original silent-success behavior for old
    // bundles; new bundles populate the field and get the proper
    // exit-1 signal.
    const fatalParseIssue = (result.parseIssues ?? []).some(
      issue => issue.level === 'error'
    )
    // A failed typecheck is non-fatal-but-noticeable: signal exit 1
    // (the convention `parseIssues` already uses for "ran but found
    // problems"). The generated files stay on disk so the operator
    // can fix the generator and rerun.
    const typecheckFailed = typecheckResult?.kind === 'failed'
    Deno.exit(fatalParseIssue || typecheckFailed ? 1 : 0)
  }

  // Interactive mode + no resolvable args → mount Ink for the user
  // to fill in the gaps.
  const { renderGenerate } = await import('@/commands/generate.tsx')
  return await renderGenerate({ projectName, schemaSourceString, watch })
}
