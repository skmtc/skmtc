import * as Sentry from '@sentry/deno'
import { cors } from 'hono/cors'
import { Hono } from 'hono'
import {
  clientSettings as settingsSchema,
  toArtifacts,
  stringToSchema,
  toV3Document
} from '@skmtc/core'
import type { GeneratorsMapContainer } from '@skmtc/core'
import * as v from 'valibot'

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

    const result = await Sentry.startSpan({ name: 'POST /artifacts' }, async span => {
      const body = await c.req.json()

      const { schema, clientSettings, prettier } = v.parse(postArtifactsBody, body)

      console.log('BASE PATH', clientSettings?.basePath)

      const documentObject = await toV3Document(stringToSchema(schema))

      return await Sentry.startSpan({ name: 'Generate' }, async () => {
        const { traceId, spanId } = span.spanContext()

        const { artifacts, manifest } = await toArtifacts({
          traceId,
          spanId,
          startAt,
          documentObject,
          prettier,
          settings: clientSettings,
          toGeneratorConfigMap,
          logsPath,
          silent: true
        })

        return { artifacts, manifest }
      })
    })

    return c.json(result, 200)
  })

  app.get('/generators', c => {
    return Sentry.startSpan({ name: 'GET /generators' }, () => {
      return c.json({ generators: Object.keys(toGeneratorConfigMap()) })
    })
  })

  app.post('/to-v3-json', async c => {
    return await Sentry.startSpan({ name: 'POST /to-v3-json' }, async () => {
      const body = await c.req.json()

      const { schema } = v.parse(v.object({ schema: v.string() }), body)

      const oas30Document = await toV3Document(stringToSchema(schema))

      return c.json({ schema: oas30Document })
    })
  })

  return app
}
