import { toArtifacts } from '@skmtc/core'
import skmtcGenZod from '../../../../skmtc-generators/gen-zod/mod.ts'
import { StackTrail } from '../context/StackTrail.ts'

export const gen = async () => {
  const schemaPath = new URL('./openapi.json', import.meta.url)

  const schema = await Deno.readTextFile(schemaPath)

  const traceId = 'AAA'
  const spanId = 'BBB'

  const { artifacts, manifest } = toArtifacts({
    traceId,
    spanId,
    startAt: Date.now(),
    document: { type: 'oas', value: JSON.parse(schema) },
    settings: undefined,
    // @ts-ignore - enrichment types do not work at this level
    toGeneratorConfigMap: () => Object.fromEntries([skmtcGenZod].map(g => [g.id, g])),
    stackTrail: new StackTrail([traceId, spanId]),
    logsPath: './logs',
    silent: true
  })

  return { artifacts, manifest }
}

console.time('GEN')

gen()
