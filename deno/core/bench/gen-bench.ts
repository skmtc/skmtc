import { toArtifacts, StackTrail } from '@skmtc/core'
import skmtcGenZod from '../../../../.skmtc/skmtc-zod/gen-zod/mod.ts'

Deno.bench('gen', async () => {
  const schemaPath = new URL('./openapi.json', import.meta.url)

  const schema = await Deno.readTextFile(schemaPath)

  toArtifacts({
    traceId: 'AAA',
    spanId: 'BBB',
    startAt: Date.now(),
    documentObject: JSON.parse(schema),
    prettier: undefined,
    settings: undefined,
    toGeneratorConfigMap: () => Object.fromEntries([skmtcGenZod].map(g => [g.id, g])),
    logsPath: undefined,
    silent: true,
    stackTrail: new StackTrail(['bench'])
  })
})
