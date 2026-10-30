import { Command, EnumType } from '@cliffy/command'
import { EnvVariableError } from '@/lib/env.ts'
import { HUB_ENVS } from '@/lib/hub-env.ts'
import { API_VISIBILITIES } from '@/lib/api-publish-headless.ts'
import { FEEDBACK_KINDS } from '@/lib/feedback-headless.ts'
import { assertJsrReachable, JsrRegistryUnreachableError } from '@/lib/jsr-registry.ts'
import { DeviceLoginError } from '@/lib/device-login.ts'
import {
  ENV_DESCRIPTION,
  getCommandDescriptor,
  JSON_DESCRIPTION,
  NO_INPUT_DESCRIPTION
} from '@/lib/cli-schema.ts'
import { toInstallCommand } from '@/commands/install-command.ts'
import denoJson from './deno.json' with { type: 'json' }

// Sentry.init({
//   dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
// })

// Commands that don't need JSR to do their job are allow-listed here so
// they keep working offline. Adding new commands defaults to "requires
// registry" — make it an explicit decision when something can skip the
// check. `doctor` is a partial exception: its `cli-version-current`
// check asks the registry which CLI version is current, and
// `project-package-copies` runs `deno info`, which downloads on a cold
// cache. Both are bounded and degrade to `skipped`, so doctor still
// reports every other check offline (`--offline` skips both outright).
const COMMANDS_THAT_SKIP_REGISTRY_CHECK = new Set<string>([
  'generate',
  'dev',
  'doctor',
  'agent-context',
  'clean',
  // status is read-only against the local manifest + lock. Its fresh
  // render builds a bundle outside the project from the locked pins,
  // bounded by a timeout, and degrades when that fails.
  'status',
  // eject/adopt move files between engine and user ownership — pure
  // local filesystem + config operations.
  'eject',
  'adopt',
  // describe builds the project's bundle outside the project from the
  // locked pins, then runs it to read generator capabilities. (generate
  // --debug is covered by 'generate' above — it runs the local worker.ts
  // source.)
  'describe',
  // login/logout/whoami talk to the hub (or just the local filesystem),
  // not the JSR registry.
  'login',
  'logout',
  'whoami',
  // feedback sends a problem or a feature request to the hub.
  'feedback',
  // push/pull move client.json to/from the hub; neither touches JSR.
  'push',
  'pull',
  // project fork/rm manage hub projects; they never touch JSR.
  'project',
  // api publish and api link talk to the hub; they never touch JSR.
  'api'
])

const shouldSkipRegistryCheck = (args: readonly string[]): boolean => {
  // `skmtc --version` / `-v` prints a local constant — it must stay
  // instant and work offline, so never gate it behind the JSR check.
  if (args[0] === '--version' || args[0] === '-v') return true
  const firstArg = args.find(arg => !arg.startsWith('-'))
  if (!firstArg) return false
  return COMMANDS_THAT_SKIP_REGISTRY_CHECK.has(firstArg)
}

// Strings reused on every agent-mode command. They come from
// `cli-schema.ts`, whose {@link AGENT_MODE_FLAGS} `agent-context` reports.
const NO_INPUT_DESC = NO_INPUT_DESCRIPTION
const JSON_DESC = JSON_DESCRIPTION
const ENV_DESC = ENV_DESCRIPTION
const FORCE_DESC =
  "Bypass the pre-flight @skmtc/core peer-pin check. Cloning over a mismatched pin produces a generator that won't bundle — only use this when you know the skew is safe."

const run = async () => {
  if (!shouldSkipRegistryCheck(Deno.args)) {
    try {
      await assertJsrReachable()
    } catch (error) {
      if (error instanceof JsrRegistryUnreachableError || error instanceof EnvVariableError) {
        console.error(error.message)
        Deno.exit(1)
      }
      throw error
    }
  }

  const generatorType = new EnumType(['operation', 'model'])
  const hubEnv = new EnumType(HUB_ENVS)
  const apiVisibility = new EnumType(API_VISIBILITIES)
  const feedbackKind = new EnumType(FEEDBACK_KINDS)
  const generatorLanguage = new EnumType(['typescript', 'kotlin'])

  // The descriptors in `lib/cli-schema.ts` are the source of truth for
  // each command's `description` and the human-readable args pattern
  // (which `agent-context` also reads). The `.arguments(...)` strings
  // carry Cliffy's type annotations (`:string`, …), which don't belong
  // in the descriptor. Most stay inline below; `install` is built in
  // `commands/install-command.ts` so its parsing can be tested.
  // The `--json` / `--no-input` option pair is repeated on every
  // `full`-agent-mode command because Cliffy's chain types don't
  // round-trip through a generic helper without losing precision.

  const initCommand = new Command()
    .description(getCommandDescriptor('init').description)
    .arguments('[projectName:string] [basePath:string]')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .action(async ({ json, input }, projectName, basePath) => {
      const { renderInit } = await import('@/commands/init.tsx')
      await renderInit({
        projectName,
        basePath,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const createCommand = new Command()
    .description(getCommandDescriptor('create').description)
    .type('generatorType', generatorType)
    .type('generatorLanguage', generatorLanguage)
    .arguments('<project:string> <generator:string> <type:generatorType>')
    .option(
      '-l, --lang <language:generatorLanguage>',
      'Target output language for the scaffolded generator.',
      {
        default: 'typescript' as const
      }
    )
    .action(async (options, projectName, generator, type) => {
      const { renderCreate } = await import('@/commands/create.tsx')
      await renderCreate({
        projectName,
        generator,
        type,
        language: options.lang
      })
    })

  const cloneCommand = new Command()
    .description(getCommandDescriptor('clone').description)
    .arguments('[project:string]')
    .option(
      '-g, --generator <id:string>',
      'Generator id (JSR specifier) to clone. Repeat for multiple.',
      { collect: true }
    )
    .option('--force', FORCE_DESC)
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .action(async ({ json, input, generator, force }, projectName) => {
      const { renderClone } = await import('@/commands/clone.tsx')
      await renderClone({
        projectName,
        generators: generator,
        force,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const installCommand = toInstallCommand()

  const listCommand = new Command()
    .description(getCommandDescriptor('list').description)
    .arguments('[project:string]')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .action(async ({ json, input }, projectName) => {
      // Cliffy negates `--no-input` to `input: boolean`. `input === false`
      // means the user passed `--no-input`; default is `true`.
      const { renderList } = await import('@/commands/list.tsx')
      await renderList({
        projectName,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const removeCommand = new Command()
    .description(getCommandDescriptor('remove').description)
    .arguments('[project:string] [generator:string]')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .action(async ({ json, input }, projectName, generator) => {
      const { renderRemove } = await import('@/commands/remove.tsx')
      await renderRemove({
        projectName,
        generator,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const generateCommand = new Command()
    .description(getCommandDescriptor('generate').description)
    .arguments('<project:string> [schema:string]')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC + ' Incompatible with --watch.')
    .option(
      '--typecheck',
      'After generating, run `tsc --noEmit` against the consumer tsconfig and surface ' +
        "diagnostics scoped to this run's files. Exit 1 on any type error."
    )
    .option(
      '--tsconfig <path:string>',
      'Override the tsconfig used by --typecheck. Defaults to the nearest tsconfig.json ' +
        'walking up from basePath.'
    )
    .option(
      '--tsc-cmd <cmd:string>',
      'Override the tsc command used by --typecheck. Defaults to `npx tsc`; useful for ' +
        'pnpm/bun setups (e.g. `--tsc-cmd "pnpm exec tsc"`).'
    )
    .option(
      '--anchors',
      'Force gen-maps (attribution) output ON, regardless of ' +
        '`client.json#settings.anchors.enabled`. Emits sidecars + a ' +
        'generation map under `.skmtc/<project>/.maps/`.'
    )
    .option('--no-anchors', 'Force gen-maps (attribution) output OFF, regardless of config.')
    .option(
      '--debug',
      'Run generation under the V8 inspector in source mode (not the bundle) so a ' +
        'debugger can pause on breakpoints in generator code and inspect the live files ' +
        'map at each stop. Pairs with the SKMTC Debug VS Code extension.'
    )
    .option(
      '--auto',
      'With --debug, run generation immediately instead of waiting for a debugger to attach.'
    )
    .action(
      async (
        { watch, json, input, typecheck, tsconfig, tscCmd, anchors, debug, auto },
        projectName,
        schemaSourceString
      ) => {
        if (debug) {
          const { renderDebug } = await import('@/commands/debug.ts')
          await renderDebug({
            projectName,
            schemaSourceString,
            autoFlag: auto
          })
          return
        }
        const { generateSwitch } = await import('@/commands/generate-switch.ts')
        await generateSwitch({
          projectName,
          schemaSourceString,
          watch,
          jsonFlag: json,
          noInputFlag: input === false,
          typecheck,
          tsconfig,
          tscCmd,
          // Cliffy maps `--anchors` / `--no-anchors` to a `boolean |
          // undefined` field — undefined when neither was passed.
          anchorsFlag: anchors
        })
      }
    )

  const bundleCommand = new Command()
    .description(getCommandDescriptor('bundle').description)
    .arguments('[project:string]')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .action(async ({ json, input }, projectName) => {
      const { renderBundle } = await import('@/commands/bundle.tsx')
      await renderBundle({
        projectName,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const cleanCommand = new Command()
    .description(getCommandDescriptor('clean').description)
    // Optional in Cliffy so a missing project routes to the recipe
    // error (with the `ls .skmtc/` discovery hint) instead of Cliffy's
    // terse "Missing argument(s)" — matches `remove` / `list`.
    .arguments('[project:string]')
    .option('--json', 'Emit structured JSON output.')
    .option(
      '--dry-run',
      'List the files and directories that would be deleted without touching disk.'
    )
    .option('--verbose', 'List every deleted file and pruned directory in text output.')
    .action(async ({ json, dryRun, verbose }, projectName) => {
      const { renderClean } = await import('@/commands/clean.ts')
      await renderClean({
        projectName,
        jsonFlag: json,
        dryRunFlag: dryRun,
        verboseFlag: verbose
      })
    })

  const statusCommand = new Command()
    .description(getCommandDescriptor('status').description)
    // Optional in Cliffy so a missing project routes to the recipe
    // error (with the `ls .skmtc/` discovery hint) instead of Cliffy's
    // terse "Missing argument(s)" — matches `clean` / `list`.
    .arguments('[project:string]')
    .option('--json', 'Emit structured JSON output.')
    .option('--check', 'Exit 1 when any generated file is modified or orphaned (CI gate).')
    .option('--verbose', 'List every file with its status, not just modified ones.')
    .action(async ({ json, check, verbose }, projectName) => {
      const { renderStatus } = await import('@/commands/status.ts')
      await renderStatus({
        projectName,
        jsonFlag: json,
        checkFlag: check,
        verboseFlag: verbose
      })
    })

  const ejectCommand = new Command()
    .description(getCommandDescriptor('eject').description)
    // Optional in Cliffy so missing args route to the recipe error
    // (with discovery hints) — matches `clean` / `status`.
    .arguments('[project:string] [file:string]')
    .option('--json', 'Emit structured JSON output.')
    .action(async ({ json }, projectName, file) => {
      const { renderEject } = await import('@/commands/eject.ts')
      await renderEject({ projectName, file, jsonFlag: json })
    })

  const adoptCommand = new Command()
    .description(getCommandDescriptor('adopt').description)
    .arguments('[project:string] [file:string]')
    .option('--json', 'Emit structured JSON output.')
    .action(async ({ json }, projectName, file) => {
      const { renderAdopt } = await import('@/commands/eject.ts')
      await renderAdopt({ projectName, file, jsonFlag: json })
    })

  const describeCommand = new Command()
    .description(getCommandDescriptor('describe').description)
    // Optional project arg routes a missing value to the recipe error
    // (with the `ls .skmtc/` discovery hint), matching `clean` / `list`.
    .arguments('[project:string] [schema:string]')
    .option('--json', 'Emit structured JSON output.')
    .action(async ({ json }, projectName, schemaSourceString) => {
      const { renderDescribe } = await import('@/commands/describe.ts')
      await renderDescribe({
        projectName,
        schemaSourceString,
        jsonFlag: json
      })
    })

  const devCommand = new Command()
    .description(getCommandDescriptor('dev').description)
    .arguments('<project:string> [schema:string]')
    .action(async (_options, projectName, schemaSourceString) => {
      const { dev } = await import('@/commands/dev.ts')
      await dev({ projectName, schemaSourceString })
    })

  const publishCommand = new Command()
    .description(getCommandDescriptor('publish').description)
    .arguments('<project:string>')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option('--token <token:string>', 'Personal access token. Defaults to $SKMTC_HUB_TOKEN.')
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .option(
      '--version <version:string>',
      "Version to publish. Defaults to the project root deno.json's `version`."
    )
    .action(async ({ json, input, token, env, version }, projectName) => {
      const { renderPublish } = await import('@/commands/publish.tsx')
      await renderPublish({
        projectName,
        token,
        env,
        version,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const pushCommand = new Command()
    .description(getCommandDescriptor('push').description)
    .arguments('<project:string>')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option(
      '--token <token:string>',
      'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .option(
      '--project <ref:string>',
      'Hub destination as @account/slug. Defaults to the `project` field in client.json.'
    )
    .option('--force', 'Overwrite existing config without the confirmation prompt.')
    .option(
      '--base-files',
      "Also push the app's base files (the hand-authored tree the generated code imports) alongside the config."
    )
    .option(
      '--base-files-only',
      "Push ONLY the app's base files; leave the hub project's client.json config untouched. Mutually exclusive with overwriting config."
    )
    .action(
      async (
        { json, input, token, env, project, force, baseFiles, baseFilesOnly },
        projectName
      ) => {
        const { renderPush } = await import('@/commands/push.ts')
        await renderPush({
          projectName,
          token,
          env,
          project,
          force,
          baseFiles,
          baseFilesOnly,
          jsonFlag: json,
          noInputFlag: input === false
        })
      }
    )

  const pullCommand = new Command()
    .description(getCommandDescriptor('pull').description)
    .arguments('<project:string>')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option(
      '--token <token:string>',
      'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .option(
      '--project <ref:string>',
      'Hub destination as @account/slug. Defaults to the `project` field in client.json.'
    )
    .option('--force', 'Overwrite the local config without the confirmation prompt.')
    .action(async ({ json, input, token, env, project, force }, projectName) => {
      const { renderPull } = await import('@/commands/pull.ts')
      await renderPull({
        projectName,
        token,
        env,
        project,
        force,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const loginCommand = new Command()
    .description(getCommandDescriptor('login').description)
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option(
      '--with-token',
      'Read a personal access token from stdin instead of signing in in the browser.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .action(async ({ json, withToken, env }) => {
      const { renderLogin } = await import('@/commands/login.tsx')
      await renderLogin({
        env,
        withToken,
        jsonFlag: json
      })
    })

  const logoutCommand = new Command()
    .description(getCommandDescriptor('logout').description)
    .option('--json', 'Emit structured JSON output.')
    .action(async ({ json }) => {
      const { renderLogout } = await import('@/commands/logout.ts')
      await renderLogout({ jsonFlag: json })
    })

  const whoamiCommand = new Command()
    .description(getCommandDescriptor('whoami').description)
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option(
      '--token <token:string>',
      'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .action(async ({ json, input, token, env }) => {
      const { renderWhoami } = await import('@/commands/whoami.ts')
      await renderWhoami({ token, env, jsonFlag: json, noInputFlag: input === false })
    })

  const feedbackCommand = new Command()
    .description(getCommandDescriptor('feedback').description)
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .type('feedbackKind', feedbackKind)
    .option('--kind <kind:feedbackKind>', 'problem or feature_request. Required.')
    .option('--summary <text:string>', 'One line, at most 200 characters. Required.')
    .option('--details <text:string>', 'At most 8000 characters. Required.')
    .option('--operation <name:string>', 'The command or operation the feedback is about.')
    .option('--resource <ref:string>', 'The resource it is about, such as @acme/pets.')
    .option('--request-id <id:string>', 'The request id from a failed hub command.')
    .option(
      '--token <token:string>',
      'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .action(
      async ({
        json,
        input,
        kind,
        summary,
        details,
        operation,
        resource,
        requestId,
        token,
        env
      }) => {
        const { renderFeedback } = await import('@/commands/feedback.ts')
        await renderFeedback({
          kind,
          summary,
          details,
          operation,
          resource,
          requestId,
          token,
          env,
          jsonFlag: json,
          noInputFlag: input === false
        })
      }
    )

  const doctorCommand = new Command()
    .description(getCommandDescriptor('doctor').description)
    .option('--json', 'Emit structured JSON output.')
    .option(
      '--offline',
      'Skip the registry lookup behind `cli-version-current`, which reports `skipped` instead.'
    )
    .action(async ({ json, offline }) => {
      const { renderDoctor } = await import('@/commands/doctor.ts')
      await renderDoctor({ jsonFlag: json, offlineFlag: offline })
    })

  const agentContextCommand = new Command()
    .description(getCommandDescriptor('agent-context').description)
    .option('--json', 'Emit structured JSON output.')
    .action(async ({ json }) => {
      const { renderAgentContext } = await import('@/commands/agent-context.ts')
      renderAgentContext({ jsonFlag: json })
    })

  const projectCreateCommand = new Command()
    .description(
      'Create a new hub project named <name> from the local setup: stack from deno.json#name, API from client.json#api (or register client.json#source), config from client.json. Create-only — a name clash fails (use `push` to update an existing project).'
    )
    .arguments('<name:string>')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option(
      '--token <token:string>',
      'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .option(
      '--from <project:string>',
      'Local project (.skmtc/<project>) to build from. Defaults to the only project when there is one.'
    )
    .option(
      '--stack-version <version:string>',
      'Pin the stack to an exact published version. Defaults to `latest`.'
    )
    .option('--visibility <vis:string>', 'Project visibility: public or private (default private).')
    .option(
      '--base-files',
      "Also seed the app's base files (needed for the live preview container)."
    )
    .action(
      async ({ json, input, token, env, from, stackVersion, visibility, baseFiles }, name) => {
        const { renderProjectCreate } = await import('@/commands/project.ts')
        await renderProjectCreate({
          name,
          from,
          token,
          env,
          stackVersion,
          visibility,
          baseFiles,
          jsonFlag: json,
          noInputFlag: input === false
        })
      }
    )

  const projectRmCommand = new Command()
    .description('Delete a hub project named <name>. Deleting needs the admin:resource scope.')
    .arguments('<name:string>')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option(
      '--token <token:string>',
      'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .option(
      '--from <project:string>',
      'Local project whose account scopes a bare <name>. Defaults to the only project.'
    )
    .action(async ({ json, input, token, env, from }, name) => {
      const { renderProjectRm } = await import('@/commands/project.ts')
      await renderProjectRm({
        name,
        from,
        token,
        env,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const projectCommand = new Command()
    .description('Manage a hub project built from the local setup (create / rm).')
    .action(() => {
      console.error('Usage: skmtc project <subcommand>')
      console.error('Subcommands:')
      console.error('  create <name>   Create a new hub project from the local setup.')
      console.error('  rm <name>       Delete a hub project.')
      Deno.exit(2)
    })
    .command('create', projectCreateCommand)
    .command('rm', projectRmCommand)

  const apiPublishCommand = new Command()
    .description(getCommandDescriptor('api publish').description)
    .arguments('[file:string]')
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option('--api <ref:string>', 'The hub API as @account/slug. Required.')
    .type('visibility', apiVisibility)
    .option(
      '--visibility <visibility:visibility>',
      'public or private. Creates the API when it is missing; without it the API must exist.'
    )
    .option(
      '--origin-url <url:string>',
      'Where these bytes can be fetched. The revisions route records it as the revision source; the create route (--visibility) records it once the hub accepts it.'
    )
    .option(
      '--token <token:string>',
      'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`, then, in GitHub Actions with `id-token: write`, a linked repository token for the API.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .action(async ({ json, input, api, visibility, originUrl, token, env }, file) => {
      const { renderApiPublish } = await import('@/commands/api.ts')
      await renderApiPublish({
        file,
        api,
        visibility,
        originUrl,
        token,
        env,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const apiLinkCommand = new Command()
    .description(getCommandDescriptor('api link').description)
    .option('--no-input', NO_INPUT_DESC)
    .option('--json', JSON_DESC)
    .option('--api <ref:string>', 'The hub API as @account/slug. Required.')
    .option(
      '--repo <repo:string>',
      'The GitHub repository as <owner>/<repo>. Defaults to the origin remote.'
    )
    .option(
      '--workflow <path:string>',
      'The workflow file, e.g. .github/workflows/publish.yml. Defaults to the only workflow that publishes.'
    )
    .option(
      '--environment <name:string>',
      'The GitHub environment the workflow job runs in. Unset: any environment.'
    )
    .option(
      '--no-open',
      'Print the page and do not open the browser. --json alone still opens it; an agent passes --no-open.'
    )
    .option(
      '--token <token:string>',
      'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
    )
    .type('hubEnv', hubEnv)
    .option('--env <env:hubEnv>', ENV_DESC)
    .action(async ({ json, input, api, repo, workflow, environment, open, token, env }) => {
      const { renderApiLink } = await import('@/commands/api.ts')
      await renderApiLink({
        api,
        repo,
        workflow,
        environment,
        open,
        token,
        env,
        jsonFlag: json,
        noInputFlag: input === false
      })
    })

  const apiCommand = new Command()
    .description('Manage hub APIs (publish, link).')
    .action(() => {
      console.error('Usage: skmtc api <subcommand>')
      console.error('Subcommands:')
      console.error('  publish <file> --api @account/slug   Add a document as an API revision.')
      console.error(
        '  link --api @account/slug             Make a link request for a GitHub repository.'
      )
      Deno.exit(2)
    })
    .command('publish', apiPublishCommand)
    .command('link', apiLinkCommand)

  const migrateVariantsCommand = new Command()
    .description(
      "Migrate a project's client.json to the variant-aware shape introduced in @skmtc/core@0.5.0. " +
        'Idempotent — safe to re-run.'
    )
    .arguments('<project:string>')
    .option('--json', 'Emit structured JSON output.')
    .action(async ({ json }, projectName) => {
      const { renderMigrateVariants } = await import('@/commands/migrate-variants.ts')
      await renderMigrateVariants({ projectName, jsonFlag: json })
    })

  const migrateCommand = new Command()
    .description(
      'Apply one-shot migrations to a project. Currently supports `variants` ' +
        '(wrap operation enrichments + reshape skip/include for the variant axis).'
    )
    .action(() => {
      console.error('Usage: skmtc migrate <subcommand>')
      console.error('Subcommands:')
      console.error('  variants <project>   Migrate to the variant-aware shape.')
      Deno.exit(2)
    })
    .command('variants', migrateVariantsCommand)

  await new Command()
    .description('Generate code from an OpenAPI or GraphQL schema')
    // Root-local (not global) so it never clashes with `publish
    // --version <v>`. `standalone` means it can't be combined with a
    // subcommand; the action prints the version and exits.
    .option('-v, --version', 'Show the SKMTC CLI version and exit.', {
      standalone: true,
      action: () => {
        console.log(denoJson.version)
        Deno.exit(0)
      }
    })
    .action(async _flags => {
      const { runPrompt } = await import('@/prompt/run-prompt.tsx')
      await runPrompt()
    })
    .command('init', initCommand)
    .command('create', createCommand)
    .command('clone', cloneCommand)
    .command('install', installCommand)
    .command('list', listCommand)
    .command('remove', removeCommand)
    .command('generate', generateCommand)
    .command('bundle', bundleCommand)
    .command('clean', cleanCommand)
    .command('status', statusCommand)
    .command('eject', ejectCommand)
    .command('adopt', adoptCommand)
    .command('describe', describeCommand)
    .command('publish', publishCommand)
    .command('push', pushCommand)
    .command('pull', pullCommand)
    .command('project', projectCommand)
    .command('api', apiCommand)
    .command('login', loginCommand)
    .command('logout', logoutCommand)
    .command('whoami', whoamiCommand)
    .command('feedback', feedbackCommand)
    .command('dev', devCommand)
    .command('doctor', doctorCommand)
    .command('agent-context', agentContextCommand)
    .command('migrate', migrateCommand)
    .parse(Deno.args)
}

// A malformed environment variable, or a stored sign-in that cannot be
// refreshed, surfaces in whichever command needs it; report it once here, as
// one line, for every entry point.
run().catch(error => {
  if (error instanceof EnvVariableError || error instanceof DeviceLoginError) {
    console.error(error.message)
    Deno.exit(1)
  }
  throw error
})
