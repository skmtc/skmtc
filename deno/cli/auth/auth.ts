import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const toLoginPrompt = async (skmtcRoot: SkmtcRoot) => {
  await skmtcRoot.login()
}

export const toLoginCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command().description('Log in to Codesquared').action(async () => {
    await skmtcRoot.login()
  })
}

export const toLogoutPrompt = async (skmtcRoot: SkmtcRoot) => {
  await skmtcRoot.logout()
}

export const toLogoutCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description('Log out of Codesquared')
    .action(async () => await skmtcRoot.logout())
}
