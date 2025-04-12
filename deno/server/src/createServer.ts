import * as Sentry from '@sentry/deno'
import { cors } from 'hono/cors'
import { Hono } from 'hono'
import { CoreContext, clientSettings as settingsSchema, transform } from '@skmtc/core'
import type { GeneratorsMapContainer } from '@skmtc/core'
import { stringToSchema, toV3Document } from './toV3Document.ts'
import * as v from 'valibot'

const postSettingsBody = v.object({
  defaultSelected: v.optional(v.boolean()),
  schema: v.string(),
  clientSettings: v.optional(settingsSchema)
})

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

  app.all('/proxy/*', c => {
    // const response = await fetch('https://example.com')
    // // clone the response to return a response with modifiable headers
    // const newResponse = new Response(response.body, response)
    // return newResponse
    const url = new URL(c.req.url)
    url.pathname = url.pathname.replace(/^\/proxy/i, '')
    url.host = 'platform.reapit.cloud'

    const req = new Request(url, {
      method: c.req.method,
      headers: c.req.header(),
      body: c.req.raw.body
    })

    console.log('REQ', req)

    return fetch(req)
  })

  app.post('/artifacts', async c => {
    const startAt = Date.now()

    const result = await Sentry.startSpan({ name: 'POST /artifacts' }, async span => {
      const body = await c.req.json()

      const { schema, clientSettings, prettier } = v.parse(postArtifactsBody, body)

      const documentObject = await toV3Document(stringToSchema(schema))

      return Sentry.startSpan({ name: 'Generate' }, () => {
        const { traceId, spanId } = span.spanContext()

        const { artifacts, manifest } = transform({
          traceId,
          spanId,
          startAt,
          documentObject,
          prettier,
          settings: clientSettings,
          toGeneratorConfigMap,
          logsPath
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

  app.post('/settings', async c => {
    return await Sentry.startSpan({ name: 'POST /settings' }, async span => {
      const body = await c.req.json()

      const { clientSettings, defaultSelected = false, schema } = v.parse(postSettingsBody, body)

      const documentObject = await toV3Document(stringToSchema(schema))

      const context = new CoreContext({ spanId: span.spanContext().spanId })

      const generators = context.generateSettings({
        documentObject,
        clientSettings,
        toGeneratorConfigMap,
        defaultSelected
      })

      return c.json({ generators })
    })
  })

  return app
}
