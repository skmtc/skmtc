// Commands that don't need JSR to do their job are allow-listed here so
// they keep working offline. Adding new commands defaults to "requires
// registry" — make it an explicit decision when something can skip the
// check. `doctor` is a partial exception: its `cli-version-current`
// check asks the registry which CLI version is current, and
// `project-package-copies` runs `deno info`, which downloads on a cold
// cache. Both are bounded and degrade to `skipped`, so doctor still
// reports every other check offline (`--offline` skips both outright).
export const COMMANDS_THAT_SKIP_REGISTRY_CHECK: ReadonlySet<string> = new Set<string>([
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

export const shouldSkipRegistryCheck = (args: readonly string[]): boolean => {
  // `skmtc --version` / `-v` prints a local constant — it must stay
  // instant and work offline, so never gate it behind the JSR check.
  if (args[0] === '--version' || args[0] === '-v') return true
  const firstArg = args.find(arg => !arg.startsWith('-'))
  if (!firstArg) return false
  return COMMANDS_THAT_SKIP_REGISTRY_CHECK.has(firstArg)
}
