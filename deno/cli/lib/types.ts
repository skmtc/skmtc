import type { Command } from '@cliffy/command'
import type { SkmtcRoot } from './skmtc-root.ts'

export type ControllerFilteArgs = {
  hasHome: boolean
  hasGenerators: boolean
}

export type Controller = {
  action: string
  description: string
  toCommand: () => Command
  toPrompt: (skmtcRoot: SkmtcRoot) => Promise<void>
  filter: (args: ControllerFilteArgs) => boolean
}
