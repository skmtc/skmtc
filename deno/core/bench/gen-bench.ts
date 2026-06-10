import { toArtifacts, StackTrail } from '@skmtc/core'
import skmtcGenZod from '../../../../skmtc-generators/gen-zod/mod.ts'

Deno.bench('gen', async () => {
  const schemaPath = new URL('./openapi.json', import.meta.url)

  const schema = await Deno.readTextFile(schemaPath)

  toArtifacts({
    traceId: 'AAA',
    spanId: 'BBB',
    startAt: Date.now(),
    document: { type: 'oas', value: JSON.parse(schema) },
    settings: undefined,
    // @ts-ignore - enrichment types do not work at this level
    toGeneratorConfigMap: () => Object.fromEntries([skmtcGenZod].map(g => [g.id, g])),
    logsPath: undefined,
    silent: true,
    stackTrail: new StackTrail(['bench'])
  })
})
