import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { AppAction } from '../components/types.ts'
import type { ActionDispatch } from 'react'

export const toLoginCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command().description('Log in to Skmtc').action(async () => {
    await skmtcRoot.login({
      emitLoginLink: loginLink => {
        console.log('Click the link to login')
        console.log(loginLink)
      },
      onLogin: session => {
        console.log('Logged in', session)
      }
    })
  })
}

type LogoutPromptArgs = {
  skmtcRoot: SkmtcRoot
  dispatch: ActionDispatch<[action: AppAction]>
}

export const toLogoutPrompt = async ({ skmtcRoot, dispatch }: LogoutPromptArgs) => {
  await skmtcRoot.logout({ notify: alert => dispatch({ type: 'set-alert', alert }) })
}

export const toLogoutCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command().description('Log out of Skmtc').action(async () => {
    await skmtcRoot.logout({ notify: alert => console.log(alert) })
  })
}
