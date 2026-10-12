/**
 * The environment variables the CLI reads, and the one set of rules for
 * reading them:
 *
 *   - an empty (or whitespace-only) value is unset;
 *   - a URL variable must be a URL, else {@link EnvVariableError} names it;
 *   - defaults live in the schema.
 *
 * `readEnv` reads one variable when it is needed, never the whole
 * environment at once, because most commands need none of them. The one
 * read before a command runs is `JSR_URL`, by the registry check in
 * `mod.ts`, and only for commands that use the registry.
 */

import * as v from 'valibot'

const envSchema = v.object({
  /** JSR registry the CLI resolves generators against. */
  JSR_URL: v.optional(v.pipe(v.string(), v.url()), 'https://jsr.io/'),
  /** skmtc-hub API base URL. No default here: the default ends a precedence chain. */
  SKMTC_API_ORIGIN: v.optional(v.pipe(v.string(), v.url())),
  SKMTC_HUB_TOKEN: v.optional(v.string()),
  HOME: v.optional(v.string()),
  /** The Windows equivalent of `HOME`. */
  USERPROFILE: v.optional(v.string()),
  DENO_DIR: v.optional(v.string())
})

export type EnvVariableName = keyof typeof envSchema.entries

export class EnvVariableError extends Error {
  readonly variable: EnvVariableName

  constructor(variable: EnvVariableName, reason: string) {
    super(`Environment variable ${variable} is invalid: ${reason}`)
    this.name = 'EnvVariableError'
    this.variable = variable
  }
}

export const readEnv = <Name extends EnvVariableName>(
  name: Name
): v.InferOutput<(typeof envSchema.entries)[Name]> => {
  const raw = Deno.env.get(name)?.trim()
  const result = v.safeParse(envSchema.entries[name], raw === '' ? undefined : raw)

  if (!result.success) {
    throw new EnvVariableError(name, result.issues[0].message)
  }

  return result.output
}

/** The user's home directory: `HOME` on POSIX, `USERPROFILE` on Windows. */
export const readHomeDirectory = (): string | undefined =>
  readEnv('HOME') ?? readEnv('USERPROFILE')
