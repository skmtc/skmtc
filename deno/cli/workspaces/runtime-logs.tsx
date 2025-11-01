import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Project } from '@/lib/project.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import { getRuntimeLogs } from '@/services/getRuntimeLogs.ts'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'

export const description = 'View runtime logs'

export const toRuntimeLogsCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_, projectName) => {
      const session = await skmtcRoot.manager.auth.toSession()

      const initialState: SkmtcState = {
        view: { page: 'runtime-logs', projectName },
        skmtcRoot,
        session,
        message: null,
        interactive: false,
        shortcuts: [],
        generators: []
      }

      render(<App initialState={initialState} />)
    })
}

type GenerateArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  accountName: string
  token: string
}

type GenerateOptions = {
  logSuccess?: string
}

export const runtimeLogs = async (
  { project, skmtcRoot, accountName, token }: GenerateArgs,
  { logSuccess }: GenerateOptions = {}
) => {
  try {
    await project.manifest.refresh()

    const manifest = project.manifest.contents

    if (!manifest) {
      throw new Error('Project has no manifest. Has generation been run?')
    }

    const runtimeLogs = await getRuntimeLogs({
      accountName,
      serverName: project.name,
      spanId: manifest.spanId,
      token
    })

    console.log('LOGS', runtimeLogs)

    // runtimeLogs.forEach(log => {
    //   try {
    //     const message = JSON.parse(log.message)
    //     console.error(message)
    //   } catch (error) {
    //     console.error(log.message)
    //   }
    // })
  } catch (error) {
    console.error(error)
  } finally {
    await skmtcRoot.manager.cleanup()
  }
}
