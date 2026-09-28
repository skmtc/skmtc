import { Command } from '@cliffy/command'
import { getCommandDescriptor, JSON_DESCRIPTION, NO_INPUT_DESCRIPTION } from '@/lib/cli-schema.ts'
import {
  INSTALL_ARGUMENTS,
  INSTALL_USAGE,
  type InstallArguments,
  toInstallArguments
} from '@/lib/install-arguments.ts'

export type InstallAction = (
  args: InstallArguments & { jsonFlag?: boolean; noInputFlag?: boolean }
) => Promise<void>

const renderInstallAction: InstallAction = async args => {
  const { renderInstall } = await import('@/commands/install.tsx')
  await renderInstall(args)
}

/** The `skmtc install` Cliffy command. Tests pass their own `action`. */
export const toInstallCommand = (action: InstallAction = renderInstallAction) =>
  new Command()
    .description(getCommandDescriptor('install').description)
    .arguments(INSTALL_ARGUMENTS)
    .usage(INSTALL_USAGE)
    .option('--no-input', NO_INPUT_DESCRIPTION)
    .option('--json', JSON_DESCRIPTION)
    .action(async ({ json, input }, ...values) => {
      // Cliffy negates `--no-input` to `input: boolean`.
      await action({
        ...toInstallArguments(values),
        jsonFlag: json,
        noInputFlag: input === false
      })
    })
