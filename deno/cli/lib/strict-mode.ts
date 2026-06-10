/**
 * Strict mode = "this CLI is being called by a script or agent, not a
 * human at a terminal."
 *
 * When strict mode is active the CLI:
 *   - never opens the Ink TUI
 *   - never prompts for missing input
 *   - emits structured, recipe-shaped errors when required input is
 *     missing so the caller can correct the invocation in one round-trip
 *
 * Two ways to activate it:
 *   1. The caller passes `--no-input` (explicit, recommended for agents)
 *   2. stdin or stdout is not a TTY (implicit, catches piped/CI use)
 *
 * `--no-input` wins if both signals disagree — useful when a TTY is
 * attached but the caller wants the strict surface anyway.
 */

export type InputMode = 'interactive' | 'strict'

/**
 * Output format for strict-mode commands.
 *
 * - `text` — human-readable plain text on stdout.
 * - `json` — a single JSON object on stdout, suitable for piping into
 *   `jq` or for agent consumption. Always implies strict mode (you
 *   can't render a JSON object and an Ink picker at the same time).
 */
export type OutputFormat = 'text' | 'json'

type ResolveInputModeArgs = {
  noInputFlag?: boolean
  jsonFlag?: boolean
}

export const resolveInputMode = ({
  noInputFlag,
  jsonFlag
}: ResolveInputModeArgs = {}): InputMode => {
  // `--json` implies non-interactive. Documented in the cli skill;
  // the rationale is that a structured output stream and an Ink TUI
  // are mutually exclusive presentations of the same command.
  if (noInputFlag || jsonFlag) return 'strict'

  try {
    if (!Deno.stdin.isTerminal() || !Deno.stdout.isTerminal()) {
      return 'strict'
    }
  } catch {
    // Older Deno versions or sandboxed contexts may not expose
    // isTerminal — fall back to assuming interactive so we don't break
    // working terminal sessions.
  }

  return 'interactive'
}

type ResolveOutputFormatArgs = {
  jsonFlag?: boolean
}

/**
 * Pick the output format for a strict-mode command. Today the choice
 * is binary: `--json` → JSON, otherwise plain text. Extracted into a
 * helper so every command's strict branch reads the flag through the
 * same path.
 */
export const resolveOutputFormat = ({
  jsonFlag
}: ResolveOutputFormatArgs = {}): OutputFormat => (jsonFlag ? 'json' : 'text')

type MissingArgArgs = {
  command: string
  arg: string
  usage: string
  example: string
  discover?: string
}

/**
 * Format a "required argument is missing" error as a recipe the caller
 * can act on. Includes the usage signature, a fully-specified example,
 * and (when applicable) a hint for how the caller can discover valid
 * values for the missing arg.
 */
export const formatMissingArgError = ({
  command,
  arg,
  usage,
  example,
  discover
}: MissingArgArgs): string => {
  const lines = [
    `Error: missing required argument: ${arg}`,
    '',
    `skmtc is running in non-interactive mode (stdin/stdout is not a TTY,`,
    `or --no-input was passed). All required arguments must be provided`,
    `up front — skmtc will not prompt.`,
    '',
    `Usage:   ${usage}`,
    `Example: ${example}`
  ]

  if (discover) {
    lines.push('', `Discover valid values: ${discover}`)
  }

  return lines.join('\n')
}

/**
 * Print a recipe-shaped error to stderr and exit non-zero. Use this
 * from a command's strict-mode entrypoint when required input is
 * missing; the caller gets a single readable failure instead of an Ink
 * crash with a stack trace.
 */
export const failWithRecipe = (args: MissingArgArgs): never => {
  console.error(formatMissingArgError(args))
  Deno.exit(2)
}
