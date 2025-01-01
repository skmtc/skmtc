import * as Sentry from '@sentry/deno'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { clientSettings as settingsSchema, transform } from '@skmtc/core'
import { generateSettings } from './generateSettings.ts'
import type { GeneratorsMap, GeneratorType } from '@skmtc/core'

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

type CreateServerArgs = {
  toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<
    GeneratorType<EnrichmentType>,
    EnrichmentType
  >
  logsPath?: string
}

export const createServer = ({ toGeneratorsMap, logsPath }: CreateServerArgs): Hono => {
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
        const { traceId, spanId } = span.spanContext()

        const { artifacts, manifest } = transform({
          traceId,
          spanId,
          startAt,
          schema,
          prettier,
          settings: clientSettings,
          toGeneratorsMap,
          logsPath
        })

        return { artifacts, manifest }
      })
    })

    return c.json(result)
  })

  app.get('/generators', c => {
    return Sentry.startSpan({ name: 'GET /generators' }, () => {
      return c.json({ generators: Object.keys(toGeneratorsMap()) })
    })
  })

  app.post('/settings', async c => {
    return await Sentry.startSpan({ name: 'POST /settings' }, async span => {
      const body = await c.req.json()

      const { clientSettings, defaultSelected = false, schema } = postSettingsBody.parse(body)

      const { enrichedSettings, extensions } = await generateSettings({
        toGeneratorsMap,
        schema,
        clientSettings,
        defaultSelected,
        spanId: span.spanContext().spanId
      })

      return c.json({ generators: enrichedSettings, extensions })
    })
  })

  return app
}
