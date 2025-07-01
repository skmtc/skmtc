import type { Command } from '@cliffy/command'

export type ControllerFilteArgs = {
  hasHome: boolean
  hasGenerators: boolean
}

export type Controller = {
  action: string
  description: string
  toCommand: () => Command
  toPrompt: () => Promise<void>
  filter: (args: ControllerFilteArgs) => boolean
}
