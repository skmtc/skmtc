/**
 * Positional arguments for `skmtc install <generators...> <project>`.
 *
 * Cliffy only allows a variadic argument in last position, so the
 * command takes every positional as one list and
 * {@link toInstallArguments} splits off the project.
 */
export const INSTALL_ARGUMENTS = '[arguments...:string]'

export const INSTALL_USAGE = '<generators...> <project> [options]'

export type InstallArguments = {
  generators: string[] | undefined
  projectName: string | undefined
}

/**
 * Splits `install`'s positionals into generators and project. The last
 * positional is the project when there are two or more; a single
 * positional is a generator list. Each generator positional may also be
 * a comma-separated list (`@skmtc/gen-zod,@skmtc/gen-typescript`).
 */
export const toInstallArguments = (values: readonly string[] = []): InstallArguments => {
  if (values.length === 0) {
    return { generators: undefined, projectName: undefined }
  }

  const generatorValues = values.length === 1 ? values : values.slice(0, -1)
  const projectName = values.length === 1 ? undefined : values[values.length - 1]

  const generators = generatorValues.flatMap(value =>
    value
      .split(',')
      .map(generator => generator.trim())
      .filter(generator => generator.length > 0)
  )

  return { generators, projectName }
}
