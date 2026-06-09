/**
 * Single source of truth for the SKMTC CLI's command surface.
 *
 * Used by:
 *   - `mod.ts`               — builds each Cliffy command from the
 *                              schema's description + args + flags.
 *   - `agent-context-headless.ts` — re-exports {@link COMMAND_DESCRIPTORS}
 *                              so agents can introspect the surface.
 *   - `commands/agent-context.ts` — prints the descriptors as text/JSON.
 *
 * The handler functions themselves still live in `mod.ts` because
 * each one's `action` signature is typed by the specific arg/flag set
 * Cliffy generated from `.arguments(...)` + `.option(...)`. The schema
 * here covers the *surface* (name, description, args pattern, flags,
 * agent-mode classification); the wiring layer in `mod.ts` does the
 * typed action mapping.
 *
 * Add a new command by appending an entry here AND wiring its action
 * in `mod.ts`. If you forget the latter, the command will appear in
 * `agent-context` but won't actually run — the type system can't catch
 * that today. (Future: declarative handler binding via schema-driven
 * codegen, which would close the gap.)
 */

export type FlagDescriptor = {
  /** Flag name as the user types it, including dashes (e.g. `--json`). */
  flag: string
  description: string
}

export type CommandDescriptor = {
  name: string
  description: string
  /**
   * Positional arg patterns in Cliffy form: `<x>` is required,
   * `[x]` is optional, `[x...]` is a variadic optional.
   *
   * NOTE: this is the raw Cliffy syntax — agents reading
   * `agent-context` interpret these strings as a usage hint, not as
   * a strict schema.
   */
  args: string[]
  flags: FlagDescriptor[]
  /**
   * Whether the command honors agent-mode (TTY-detect + `--json` +
   * `--no-input` + recipe errors):
   *   - `full`      : every facet supported
   *   - `json-only` : structured output without an Ink variant
   *   - `none`      : interactive only / no Ink (callable but not
   *                   ergonomic for agents)
   */
  agentMode: 'full' | 'json-only' | 'none'
}

/**
 * Standard agent-mode flag pair. Reused on every `full`-agentMode
 * command. Exposed in case mod.ts wants to apply it via a shared
 * helper.
 */
export const AGENT_MODE_FLAGS: FlagDescriptor[] = [
  { flag: '--json', description: 'Emit structured JSON output (implies --no-input).' },
  { flag: '--no-input', description: 'Disable interactive prompts; fail on missing args.' }
]

export const COMMAND_DESCRIPTORS: CommandDescriptor[] = [
  {
    name: 'init',
    description: 'Initialize a new project in current directory',
    args: ['[projectName]', '[basePath]'],
    flags: AGENT_MODE_FLAGS,
    agentMode: 'full'
  },
  {
    name: 'install',
    description: 'Install generator',
    args: ['[generators...]', '[project]'],
    flags: AGENT_MODE_FLAGS,
    agentMode: 'full'
  },
  {
    name: 'list',
    description: 'List generators in a project',
    args: ['[project]'],
    flags: AGENT_MODE_FLAGS,
    agentMode: 'full'
  },
  {
    name: 'clone',
    description: 'Clone JSR generator(s) into a project as local source',
    args: ['[project]'],
    flags: [
      ...AGENT_MODE_FLAGS,
      {
        flag: '-g, --generator <id>',
        description: 'Generator id to clone. Repeat for multiple.'
      }
    ],
    agentMode: 'full'
  },
  {
    name: 'remove',
    description: 'Remove generator from a project',
    args: ['[project]', '[generator]'],
    flags: AGENT_MODE_FLAGS,
    agentMode: 'full'
  },
  {
    name: 'bundle',
    description: "Compile a project's local generators into bundle.js",
    args: ['[project]'],
    flags: AGENT_MODE_FLAGS,
    agentMode: 'full'
  },
  {
    name: 'clean',
    description: "Delete a project's generated files (and manifest) recorded in the manifest, pruning emptied directories",
    args: ['<project>'],
    flags: [
      { flag: '--json', description: 'Emit structured JSON output.' },
      {
        flag: '--dry-run',
        description: 'List the files and directories that would be deleted without touching disk.'
      },
      {
        flag: '--verbose',
        description: 'List every deleted file and pruned directory in text output.'
      }
    ],
    agentMode: 'json-only'
  },
  {
    name: 'publish',
    description: "Build and publish an immutable version of this project to skmtc-hub. The version lands on the stack <authenticated-user>/<project>; versions are addressed by semver and re-publishing an existing version is rejected.",
    args: ['<project>'],
    flags: [
      ...AGENT_MODE_FLAGS,
      { flag: '--token <pat>', description: 'Personal access token. Defaults to $SKMTC_HUB_TOKEN.' },
      { flag: '--hub-url <url>', description: 'Hub base URL. Defaults to $SKMTC_HUB_URL or https://api.skmtc.dev.' },
      { flag: '--version <semver>', description: "Version to publish. Defaults to the project root deno.json's `version`." }
    ],
    agentMode: 'full'
  },
  {
    name: 'deploy',
    description: 'Deprecated alias for `publish` — stacks are published as immutable versions now.',
    args: ['<project>'],
    flags: [
      ...AGENT_MODE_FLAGS,
      { flag: '--token <pat>', description: 'Personal access token. Defaults to $SKMTC_HUB_TOKEN.' },
      { flag: '--hub-url <url>', description: 'Hub base URL. Defaults to $SKMTC_HUB_URL or https://api.skmtc.dev.' },
      { flag: '--version <semver>', description: "Version to publish. Defaults to the project root deno.json's `version`." }
    ],
    agentMode: 'full'
  },
  {
    name: 'generate',
    description: 'Generate artifacts from a schema',
    args: ['<project>', '[schema]'],
    flags: [
      ...AGENT_MODE_FLAGS,
      { flag: '-w, --watch', description: 'Watch schema for changes (incompatible with --json).' }
    ],
    agentMode: 'full'
  },
  {
    name: 'dev',
    description: 'Watch project files; rebundle + regenerate on change',
    args: ['<project>', '[schema]'],
    flags: [],
    agentMode: 'none'
  },
  {
    name: 'doctor',
    description: 'Diagnose common SKMTC misconfigurations',
    args: [],
    flags: [{ flag: '--json', description: 'Emit structured JSON output.' }],
    agentMode: 'json-only'
  },
  {
    name: 'agent-context',
    description: 'Print the CLI surface + current SKMTC state for agents',
    args: [],
    flags: [{ flag: '--json', description: 'Emit structured JSON output.' }],
    agentMode: 'json-only'
  },
  {
    name: 'create',
    description: 'Create new generator (interactive only)',
    args: ['<project>', '<generator>', '<type>'],
    flags: [],
    agentMode: 'none'
  }
]

/**
 * Look up a command's descriptor by name. Used by the Cliffy wiring
 * in `mod.ts` to pull `description` / `args` / `flags` from a single
 * source instead of hand-duplicating them on each Cliffy command.
 *
 * Throws when the name isn't in the schema — that's a developer
 * error (typo in `mod.ts`'s `getCommandDescriptor('foo')` call), not
 * a runtime failure mode we should silently degrade through.
 */
export const getCommandDescriptor = (name: string): CommandDescriptor => {
  const found = COMMAND_DESCRIPTORS.find(c => c.name === name)
  if (!found) {
    throw new Error(
      `Unknown command name "${name}" — not in COMMAND_DESCRIPTORS. ` +
        `Add it to cli-schema.ts or check for typos.`
    )
  }
  return found
}

/**
 * Returns the Cliffy-formatted arguments string for a command. Cliffy
 * accepts `'<a> [b]'` etc., so we join the `args` array with spaces.
 */
export const toArgsString = (descriptor: CommandDescriptor): string =>
  descriptor.args.join(' ')
