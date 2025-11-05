import { toArtifacts } from '@skmtc/core'
import skmtcGenZod from '../../../../.skmtc/skmtc-zod/gen-zod/mod.ts'
import console from 'node:console'
import { StackTrail } from '../context/StackTrail.ts'

export const gen = async () => {
  debugger

  const schemaPath = new URL('./openapi.json', import.meta.url)

  const schema = await Deno.readTextFile(schemaPath)

  const traceId = 'AAA'
  const spanId = 'BBB'

  const { artifacts, manifest } = toArtifacts({
    traceId,
    spanId,
    startAt: Date.now(),
    documentObject: JSON.parse(schema),
    prettier: undefined,
    settings: undefined,
    // @ts-expect-error - TODO: fix this
    toGeneratorConfigMap: () => Object.fromEntries([skmtcGenZod].map(g => [g.id, g])),
    stackTrail: new StackTrail([traceId, spanId]),
    logsPath: './logs',
    silent: true
  })
}

console.time('GEN')

gen()
