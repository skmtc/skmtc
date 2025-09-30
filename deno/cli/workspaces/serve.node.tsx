import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import React from 'react'

export const description = 'Run project server locally'

export const toServeCommand = (_skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> [port:string]')
    .action(async () => {
      throw new Error(
        'The serve command requires Deno runtime features and is not available in Node.js environment. ' +
          'To serve your project using Deno run: deno run jsr:@skmtc/cli serve <project name> [port]'
      )
    })
}
