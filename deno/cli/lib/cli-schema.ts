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
  {
    flag: '--json',
    description: 'Emit structured JSON output (implies --no-input).'
  },
  {
    flag: '--no-input',
    description: 'Disable interactive prompts; fail on missing args.'
  }
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
    description:
      "Delete a project's generated files (and manifest) recorded in the manifest, pruning emptied directories",
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
    name: 'status',
    description:
      'Classify every generated file against the generated lock: clean / modified (hand-edited, protected from overwrite) / missing / unverified, plus orphaned files spared from pruning. Read-only.',
    args: ['<project>'],
    flags: [
      { flag: '--json', description: 'Emit structured JSON output.' },
      {
        flag: '--check',
        description: 'Exit 1 when any generated file is modified or orphaned (CI gate).'
      },
      {
        flag: '--verbose',
        description: 'List every file with its status, not just modified ones.'
      }
    ],
    agentMode: 'json-only'
  },
  {
    name: 'eject',
    description:
      'Take ownership of a generated file: rename it to drop the generated suffix, add it to settings.ejected, and record provenance. Generators stop writing it, peer imports follow the owned path on the next generate, and it is never overwritten or deleted.',
    args: ['<project>', '<file>'],
    flags: [{ flag: '--json', description: 'Emit structured JSON output.' }],
    agentMode: 'json-only'
  },
  {
    name: 'adopt',
    description:
      'Return an ejected file to generation: rename it back to its generated name and remove it from settings.ejected. The next generate resumes writing it; a file still carrying manual edits is protected, never overwritten.',
    args: ['<project>', '<file>'],
    flags: [{ flag: '--json', description: 'Emit structured JSON output.' }],
    agentMode: 'json-only'
  },
  {
    name: 'merge',
    description:
      "Resolve drift on an ejected file: three-way merge that keeps your edits and applies the generator's changes, advancing the baseline. Refuses whole on collisions — never writes conflict markers. The file stays ejected.",
    args: ['<project>', '<file>'],
    flags: [{ flag: '--json', description: 'Emit structured JSON output.' }],
    agentMode: 'json-only'
  },
  {
    name: 'describe',
    description:
      "Report a project's preview metadata by running its bundle read-only: supported subjects (operations / models) per generator, the form-renderable enrichment descriptors, and the schema-derived enrichment defaults.",
    args: ['<project>', '[schema]'],
    flags: [{ flag: '--json', description: 'Emit structured JSON output.' }],
    agentMode: 'json-only'
  },
  {
    name: 'publish',
    description:
      'Build and publish an immutable version of this project to skmtc-hub. The stack is the project deno.json#name (@account/slug, the package name; the scope may be an org); versions are addressed by semver and re-publishing an existing version is rejected.',
    args: ['<project>'],
    flags: [
      ...AGENT_MODE_FLAGS,
      {
        flag: '--token <pat>',
        description:
          'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
      },
      {
        flag: '--origin <url>',
        description:
          'Hub origin (base URL). Defaults to $SKMTC_API_ORIGIN or https://api.skmtc.dev.'
      },
      {
        flag: '--version <semver>',
        description: "Version to publish. Defaults to the project root deno.json's `version`."
      }
    ],
    agentMode: 'full'
  },
  {
    name: 'push',
    description:
      'Push this project\'s client.json (config + enrichments) to its skmtc-hub project — the destination is the `project: "@account/slug"` field in client.json (or --project). Overwrites the hub project\'s config; the project must already exist on the hub.',
    args: ['<project>'],
    flags: [
      ...AGENT_MODE_FLAGS,
      {
        flag: '--token <pat>',
        description:
          'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
      },
      {
        flag: '--origin <url>',
        description:
          'Hub origin (base URL). Defaults to $SKMTC_API_ORIGIN or https://api.skmtc.dev.'
      },
      {
        flag: '--project <ref>',
        description:
          'Hub destination as @account/slug. Defaults to the `project` field in client.json.'
      },
      {
        flag: '--force',
        description: 'Overwrite existing config without the confirmation prompt.'
      },
      {
        flag: '--base-files',
        description:
          "Also push the app's base files (the hand-authored tree the generated code imports) to the preview."
      },
      {
        flag: '--base-files-only',
        description:
          "Push ONLY the app's base files to the preview; leave the hub project's client.json config untouched (skips the config PUT)."
      }
    ],
    agentMode: 'full'
  },
  {
    name: 'pull',
    description:
      'Pull this project\'s config (enrichments + filters) from its skmtc-hub project into the local client.json — the hub→local counterpart to push. The destination is the `project: "@account/slug"` field in client.json (or --project). Replaces the local enrichments/include/skip; preserves local basePath/packages/source. The project must already exist on the hub.',
    args: ['<project>'],
    flags: [
      ...AGENT_MODE_FLAGS,
      {
        flag: '--token <pat>',
        description:
          'Personal access token. Defaults to $SKMTC_HUB_TOKEN, then the token stored by `skmtc login`.'
      },
      {
        flag: '--origin <url>',
        description:
          'Hub origin (base URL). Defaults to $SKMTC_API_ORIGIN or https://api.skmtc.dev.'
      },
      {
        flag: '--project <ref>',
        description:
          'Hub destination as @account/slug. Defaults to the `project` field in client.json.'
      },
      {
        flag: '--force',
        description: 'Overwrite the local config without the confirmation prompt.'
      }
    ],
    agentMode: 'full'
  },
  {
    name: 'login',
    description:
      'Validate and store a skmtc-hub personal access token (paste-a-PAT login). When a token is already stored, reports the logged-in handle instead of prompting.',
    args: [],
    flags: [
      ...AGENT_MODE_FLAGS,
      {
        flag: '--with-token',
        description:
          'Read the token from stdin instead of prompting (works in non-interactive mode).'
      },
      {
        flag: '--origin <url>',
        description:
          'Hub origin (base URL) to validate against. Defaults to $SKMTC_API_ORIGIN or https://api.skmtc.dev.'
      }
    ],
    agentMode: 'full'
  },
  {
    name: 'logout',
    description: 'Delete the stored skmtc-hub token (~/.skmtc/auth.json). Idempotent.',
    args: [],
    flags: [{ flag: '--json', description: 'Emit structured JSON output.' }],
    agentMode: 'json-only'
  },
  {
    name: 'generate',
    description: 'Generate artifacts from a schema',
    args: ['<project>', '[schema]'],
    flags: [
      ...AGENT_MODE_FLAGS,
      {
        flag: '-w, --watch',
        description: 'Watch schema for changes (incompatible with --json).'
      },
      {
        flag: '--debug',
        description:
          'Run under the V8 inspector in source mode so a debugger can pause on breakpoints in generator code and inspect the live files map at each stop.'
      },
      {
        flag: '--auto',
        description: 'With --debug, run immediately instead of waiting for a debugger to attach.'
      }
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
export const toArgsString = (descriptor: CommandDescriptor): string => descriptor.args.join(' ')
