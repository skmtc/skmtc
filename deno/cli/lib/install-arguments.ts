import { getCommandDescriptor } from '@/lib/cli-schema.ts'

/**
 * Positional arguments for `skmtc install [generators...] [project]`.
 *
 * Cliffy only allows a variadic argument in last position, so the
 * command takes every positional as one list and
 * {@link toInstallArguments} tells the generators from the project.
 */
export const INSTALL_ARGUMENTS = '[generators-and-project...:string]'

/** The `install -h` usage line, from the command's descriptor. */
export const INSTALL_USAGE = getCommandDescriptor('install').args.join(' ')

/** Usage and example for strict-mode errors, where both are required. */
export const INSTALL_STRICT_USAGE = 'skmtc install <generators...> <project>'
export const INSTALL_EXAMPLE = 'skmtc install @skmtc/gen-zod @skmtc/gen-tanstack-query my-api'

const GENERATOR_SPECIFIER = /^(jsr:)?@[^/]+\/.+/

/** A JSR generator specifier: `@scope/name`, optionally `jsr:`-prefixed and versioned. */
export const isGeneratorSpecifier = (value: string): boolean => GENERATOR_SPECIFIER.test(value)

export type InstallArguments = {
  generators: string[] | undefined
  projectName: string | undefined
  /** Every value that is not a generator specifier, when there is more than one. */
  unrecognized: string[]
}

/**
 * Splits `install`'s positionals into generators and project. Generator
 * specifiers are generators; the one value that is not a specifier is
 * the project. Each positional may also be a comma-separated list
 * (`@skmtc/gen-zod,@skmtc/gen-typescript`).
 */
export const toInstallArguments = (values: readonly string[] = []): InstallArguments => {
  const items = values.flatMap(value =>
    value
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0)
  )

  const generators = items.filter(isGeneratorSpecifier)
  const others = items.filter(item => !isGeneratorSpecifier(item))

  return {
    generators: generators.length > 0 ? generators : undefined,
    projectName: others.length === 1 ? others[0] : undefined,
    unrecognized: others.length > 1 ? others : []
  }
}
