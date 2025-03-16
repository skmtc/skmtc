import * as Sentry from '@sentry/deno'
import { cors } from 'hono/cors'
import { z, createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { clientSettings as settingsSchema, transform } from '@skmtc/core'
import { generateSettings } from './generateSettings.ts'
import type { GeneratorsMapContainer } from '@skmtc/core'
import { manifestContent } from '@skmtc/core/Manifest'
import { stringToSchema, toV3Document } from './toV3Document.ts'

const postSettingsBody = z
  .object({
    defaultSelected: z.boolean().optional(),
    schema: z.string(),
    clientSettings: settingsSchema.optional()
  })
  .openapi('PostSettingsRequestBody')

const postArtifactsBody = z
  .object({
    schema: z.string(),
    clientSettings: settingsSchema.optional(),
    prettier: z.record(z.unknown()).optional()
  })
  .openapi('PostArtifactsRequestBody')

type CreateServerArgs = {
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  logsPath?: string
}

const postArtifacts = createRoute({
  method: 'post',
  path: '/artifacts',
  request: {
    body: {
      content: {
        'application/json': {
          schema: postArtifactsBody
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      description: 'Artifacts generated',
      content: {
        'application/json': {
          schema: z.object({
            artifacts: z.record(z.string()).openapi('Artifacts'),
            manifest: manifestContent
          })
        }
      }
    }
  }
})

const getGenerators = createRoute({
  method: 'get',
  path: '/generators',
  responses: {
    200: {
      description: 'Generators list',
      content: {
        'application/json': {
          schema: z.object({
            generators: z.array(z.string())
          })
        }
      }
    }
  }
})

export const createServer = ({ toGeneratorConfigMap, logsPath }: CreateServerArgs): OpenAPIHono => {
  const app = new OpenAPIHono()

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

      const { schema, clientSettings, prettier } = postArtifactsBody.parse(body)

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

  app.openapi(getGenerators, c => {
    return Sentry.startSpan({ name: 'GET /generators' }, () => {
      return c.json({ generators: Object.keys(toGeneratorConfigMap()) })
    })
  })

  app.post('/to-v3-json', async c => {
    return await Sentry.startSpan({ name: 'POST /to-v3-json' }, async () => {
      const body = await c.req.json()

      const { schema } = z.object({ schema: z.string() }).parse(body)

      const oas30Document = await toV3Document(stringToSchema(schema))

      return c.json({ schema: oas30Document })
    })
  })

  app.post('/settings', async c => {
    return await Sentry.startSpan({ name: 'POST /settings' }, async span => {
      const body = await c.req.json()

      const { clientSettings, defaultSelected = false, schema } = postSettingsBody.parse(body)

      const { enrichedSettings } = await generateSettings({
        toGeneratorConfigMap,
        schema,
        clientSettings,
        defaultSelected,
        spanId: span.spanContext().spanId
      })

      return c.json({ generators: enrichedSettings })
    })
  })

  app.doc('/openapi', {
    openapi: '3.0.3',
    info: {
      title: 'SKMTC API',
      version: '0.0.1'
    }
  })

  return app
}
