import { toGenerateLocalArgs } from '@/lib/to-generate-local-args.ts'
import { printGenerateResult } from '@/lib/print-generate-result.ts'
import {
  failWithInvalidArg,
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import { toManifestPath } from '@/lib/to-manifest-path.ts'
import { isProjectName, toProjectPath } from '@/lib/to-project-path.ts'
import { createBundle } from '@/lib/create-bundle.ts'
import { openBundleProject } from '@/lib/bundle-project.ts'
import { Manager } from '@/lib/manager.ts'
import type { generateLocal } from '@/lib/generate-local.ts'
import { runTypecheck } from '@/lib/typecheck.ts'
import { offerConfigMigrations } from '@/lib/config-migration-offer.ts'
import { saveSource, type SaveReport, toSaveBlocker } from '@/lib/save-source.ts'
import { toConfigLocation } from '@/lib/project-config.ts'
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
  /**
   * Override for `skmtc.config.json#settings.anchors.enabled`. `true` from
   * `--anchors`, `false` from `--no-anchors`, `undefined` (default)
   * to honour the config value.
   */
  anchorsFlag?: boolean
  /**
   * `--save`: store the schema argument as the top-level `source` of the
   * project's config, so the next run needs no schema argument.
   */
  saveFlag?: boolean
  /** `true` from `--count-tokens`: count the GPT tokens of the output and report them. */
  countTokens?: boolean
  /** Override for the generation run — tests stub this to skip the worker. */
  generateLocalFn?: typeof generateLocal
}

const SAVE_USAGE = 'skmtc generate <project> <schema> --save'

type SaveSchemaSourceArgs = {
  projectPath: string
  source: string
  /** The run had an error-level issue, so the source is not known to work. */
  runFailed: boolean
}

/**
 * Checks, before the run, that `--save` has a project and a config it can
 * write. Exits 2 for a name that is not a project, and 1 for a config that
 * is missing or that `generate` cannot read: a run that generates and then
 * does not save would leave the next run without its schema.
 */
const checkSaveTarget = (projectName: string): void => {
  if (!isProjectName(projectName)) {
    return failWithProjectRecipe()
  }

  const blocker = toSaveBlocker(toProjectPath(projectName))

  if (blocker !== undefined) {
    console.error(`Error: ${blocker}`)
    Deno.exit(1)
  }
}

/**
 * Stores the schema source of a run that had no error. A source is stored
 * only after it gave a result: `generate` takes any text a URL returns as
 * the schema, the page of a 404 too, and a source stored before the run
 * would replace one that works with one that does not.
 */
const saveSchemaSource = ({ projectPath, source, runFailed }: SaveSchemaSourceArgs): SaveReport => {
  if (runFailed) {
    return { type: 'skipped', source, configPath: toConfigLocation(projectPath).path }
  }

  const saved = saveSource({ projectPath, source })

  if (saved.type === 'no-config') {
    console.error(`Error: --save found no config to write at ${saved.configPath}.`)
    return Deno.exit(1)
  }

  return saved
}

export const generateSwitch = async ({
  projectName,
  schemaSourceString,
  watch,
  jsonFlag,
  noInputFlag,
  typecheck,
  tsconfig,
  tscCmd,
  anchorsFlag,
  saveFlag,
  countTokens,
  generateLocalFn
}: GenerateSwitchArgs) => {
  // `--save` stores the schema argument, so it needs one. This is a wrong
  // use of a flag in a terminal too, so the error does not name a mode.
  if (saveFlag && !schemaSourceString) {
    return failWithInvalidArg({
      message:
        '--save needs the <schema> argument. It stores the schema you pass as `source` in ' +
        'the project config. With a stored source, `skmtc generate <project>` needs no ' +
        'schema and no --save.',
      usage: SAVE_USAGE,
      example: 'skmtc generate my-api ./schema.json --save'
    })
  }

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

  if (saveFlag) {
    checkSaveTarget(projectName)
  }

  // generate reads the config without SkmtcRoot.open, so it offers the
  // migration itself, before the read (only in interactive mode).
  if (isProjectName(projectName)) {
    await offerConfigMigrations({ projectNames: [projectName] })
  }

  const generateLocalArgs = await toGenerateLocalArgs({
    projectName,
    schemaSourceString,
    watch
  }).catch(error => {
    // A schema that cannot be read (an unreachable URL, an error page) is a
    // failed generate, not a crash.
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return Deno.exit(1)
  })

  // Strict mode and `toGenerateLocalArgs` couldn't resolve everything
  // (no schema source given, none in `skmtc.config.json#source`, or the
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
        'To store the schema source, pass it once with --save: ' +
        `\`${SAVE_USAGE}\`. It is written as \`source\` in ` +
        '.skmtc/<project>/.settings/skmtc.config.json — then `skmtc generate <project>` ' +
        'is enough.'
    })
  }

  if (generateLocalArgs) {
    // A local project builds bundle.js from the pins and generator source it
    // has now, and runs the bundle that build returns. It skips the build
    // when `.settings/bundle-inputs.json` records that bundle.js was built
    // from those same inputs (see `@/lib/bundle-inputs.ts`). The build
    // refuses a module graph with two copies of `@skmtc/core` or a
    // `@skmtc/lang-*`. A REMOTE generate (`skmtc.config.json#serverUrl` set)
    // runs on the stack server and builds nothing locally.
    const bundlePath = generateLocalArgs.stackUrl ? undefined : await buildForRun(projectName)

    const runGenerateLocal =
      generateLocalFn ?? (await import('@/lib/generate-local.ts')).generateLocal
    const result = await runGenerateLocal({
      ...generateLocalArgs,
      bundlePath,
      anchorsFlag,
      countTokens
    })

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

    // If any parseIssue came back at `error` level, the run isn't a
    // success even when the JSON payload has `type: "generated"`.
    // Core's CoreContext catches top-level failures and synthesizes
    // a RUN_FAILED error so this branch can detect them — see
    // `core/context/CoreContext.ts` around the toArtifacts catch.
    //
    // `?? []` covers the case where the project's bundle.js is from
    // an older `@skmtc/core` that didn't yet emit `parseIssues` —
    // the field is then `undefined`, and `.some()` on undefined
    // would throw. Treating "no parseIssues field" as "no error
    // issues" matches the original silent-success behavior for old
    // bundles; new bundles populate the field and get the proper
    // exit-1 signal.
    const fatalParseIssue = (result.parseIssues ?? []).some(issue => issue.level === 'error')

    const savedSource =
      saveFlag && schemaSourceString
        ? saveSchemaSource({
            projectPath: generateLocalArgs.projectPath,
            source: schemaSourceString,
            runFailed: fatalParseIssue
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
      savedSource,
      format
    })

    // A failed typecheck is non-fatal-but-noticeable: signal exit 1
    // (the convention `parseIssues` already uses for "ran but found
    // problems"). The generated files stay on disk so the operator
    // can fix the generator and rerun.
    const typecheckFailed = typecheckResult?.type === 'failed'
    Deno.exit(fatalParseIssue || typecheckFailed ? 1 : 0)
  }

  // Interactive mode + no resolvable args → mount Ink for the user
  // to fill in the gaps.
  const { renderGenerate } = await import('@/commands/generate.tsx')
  return await renderGenerate({ projectName, schemaSourceString, watch, countTokens })
}

/** The error for a name that is not a project. Exits 2. */
const failWithProjectRecipe = (): never =>
  failWithRecipe({
    command: 'generate',
    arg: '<project>',
    usage: 'skmtc generate <project> [schema]',
    example: 'skmtc generate my-api ./schema.json',
    discover: 'ls .skmtc/  (list existing projects)'
  })

/**
 * Builds the project's bundle and returns the URL to run. Exits 2 for a
 * name that isn't a project, and 1 when the build fails or is refused.
 */
const buildForRun = async (projectName: string): Promise<string> => {
  if (!isProjectName(projectName)) {
    return failWithProjectRecipe()
  }

  try {
    return await createBundle({
      project: await openBundleProject(projectName, new Manager()),
      reuse: true
    })
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return Deno.exit(1)
  }
}
