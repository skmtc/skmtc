const applyEnv = (variables: Record<string, string | undefined>) => {
  for (const [name, value] of Object.entries(variables)) {
    if (value === undefined) {
      Deno.env.delete(name)
    } else {
      Deno.env.set(name, value)
    }
  }
}

/**
 * Run `fn` with `overrides` applied to the environment (`undefined` deletes
 * the variable), then put each overridden variable back as it was. The prior
 * values come from a snapshot, so a test never reads a variable by name.
 */
export const withEnv = async <T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T> | T
): Promise<T> => {
  const snapshot = Deno.env.toObject()
  const previous = Object.fromEntries(Object.keys(overrides).map(name => [name, snapshot[name]]))

  applyEnv(overrides)

  try {
    return await fn()
  } finally {
    applyEnv(previous)
  }
}
