import { cors } from 'hono/cors'
import { Hono } from 'hono'
import { clientSettings as settingsSchema, toArtifacts } from '@skmtc/core'
import type { GeneratorsMapContainer } from '@skmtc/core'
import { stringToSchema, toV3Document } from '@skmtc/convert'
import * as v from 'valibot'
import { StackTrail } from '@skmtc/core'

const postArtifactsBody = v.object({
  schema: v.string(),
  clientSettings: v.optional(settingsSchema),
  prettier: v.optional(v.record(v.string(), v.unknown()))
})

type CreateServerArgs = {
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  logsPath?: string
}

export const createServer = ({ toGeneratorConfigMap, logsPath }: CreateServerArgs): Hono => {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['api-version', 'authorization', 'content-type'],
      allowMethods: ['*'],
      credentials: true,
      exposeHeaders: ['api-version', 'authorization', 'content-type']
    })
  )

  app.post('/artifacts', async c => {
    const startAt = Date.now()

    const body = await c.req.json()

    const { schema, clientSettings, prettier } = v.parse(postArtifactsBody, body)

    const documentObject = await toV3Document(stringToSchema(schema))

    const traceId = `trace-${Date.now()}`
    const spanId = `span-${Date.now()}`

    const stackTrail = new StackTrail([traceId, spanId])

    const { artifacts, manifest } = toArtifacts({
      traceId,
      spanId,
      startAt,
      documentObject,
      prettier,
      settings: clientSettings,
      toGeneratorConfigMap,
      stackTrail,
      logsPath,
      silent: true
    })

    return c.json({ artifacts, manifest }, 200)
  })

  app.get('/generators', c => {
    return c.json({ generators: Object.keys(toGeneratorConfigMap()) })
  })

  app.post('/to-v3-json', async c => {
    const body = await c.req.json()

    const { schema } = v.parse(v.object({ schema: v.string() }), body)

    const oas30Document = await toV3Document(stringToSchema(schema))

    return c.json({ schema: oas30Document })
  })

  return app
}
