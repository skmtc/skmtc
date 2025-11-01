import { toArtifacts } from '@skmtc/core'
import skmtcGenZod from '../../../../.skmtc/skmtc-zod/gen-zod/mod.ts'

export const gen = async () => {
  debugger

  const schemaPath = new URL('./openapi.json', import.meta.url)

  const schema = await Deno.readTextFile(schemaPath)

  const { artifacts, manifest } = toArtifacts({
    traceId: 'AAA',
    spanId: 'BBB',
    startAt: Date.now(),
    documentObject: JSON.parse(schema),
    prettier: undefined,
    settings: undefined,
    toGeneratorConfigMap: () => Object.fromEntries([skmtcGenZod].map(g => [g.id, g])),
    logsPath: undefined,
    silent: false
  })
}

gen()
