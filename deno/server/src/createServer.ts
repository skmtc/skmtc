import * as Sentry from '@sentry/deno'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { clientSettings as settingsSchema, transform, CoreContext, toSettings } from '@skmtc/core'
import type { OperationGateway, ParseReturn } from '@skmtc/core'
import type { OperationInsertable, ModelInsertable, GeneratedValue } from '@skmtc/core'
import { toEnrichments } from '@skmtc/core'
import { set } from 'lodash-es'

const postSettingsBody = z.object({
  defaultSelected: z.boolean().optional(),
  schema: z.string(),
  clientSettings: settingsSchema.optional()
})

const postGenerateBody = z.object({
  schema: z.string(),
  clientSettings: settingsSchema.optional(),
  prettier: z.record(z.unknown()).optional()
})

type GeneratorsType = (
  | OperationGateway
  | OperationInsertable<GeneratedValue>
  | ModelInsertable<GeneratedValue>
)[]

type CreateServerArgs = {
  generators: GeneratorsType
  logsPath?: string
}

export const createServer = ({ generators, logsPath }: CreateServerArgs): Hono => {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: '*'
    })
  )

  app.post('/artifacts', async c => {
    const startAt = Date.now()

    const result = await Sentry.startSpan({ name: 'POST /artifacts' }, async span => {
      const body = await Sentry.startSpan({ name: 'Parse JSON' }, () => c.req.json())

      const { schema, clientSettings, prettier } = await Sentry.startSpan(
        { name: 'Validate request content' },
        () => postGenerateBody.parseAsync(body)
      )

      return Sentry.startSpan({ name: 'Generate' }, () => {
        const generatorsMap = Object.fromEntries(
          generators.map(generator => [generator.id, generator])
        )

        const { traceId, spanId } = span.spanContext()

        const { artifacts, manifest } = transform({
          traceId,
          spanId,
          startAt,
          schema,
          prettier,
          settings: clientSettings,
          generatorsMap,
          logsPath
        })

        return { artifacts, manifest }
      })
    })

    return c.json(result)
  })

  app.get('/generators', c => {
    return Sentry.startSpan({ name: 'GET /generators' }, () => c.json({ generators }))
  })

  app.post('/settings', async c => {
    return await Sentry.startSpan({ name: 'POST /settings' }, async span => {
      const body = await c.req.json()

      const { clientSettings, defaultSelected = false, schema } = postSettingsBody.parse(body)

      const { oasDocument, extensions } = toOasDocument({
        schema,
        spanId: span.spanContext().spanId
      })

      const generatorSettings = toSettings({
        generators,
        clientSettings,
        defaultSelected,
        oasDocument
      })

      const enrichments = await toEnrichments({
        generators,
        oasDocument
      })

      Object.entries(enrichments).forEach(([key, value]) => {
        set(generatorSettings, key, value)
      })

      return c.json({
        generators: generatorSettings,
        extensions
      })
    })
  })

  return app
}

type ToOasDocumentArgs = {
  schema: string
  spanId: string
}

const toOasDocument = ({ schema, spanId }: ToOasDocumentArgs): ParseReturn => {
  const context = new CoreContext({ spanId })

  return context.parse(schema)
}
