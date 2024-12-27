import * as Sentry from '@sentry/deno'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { clientSettings as settingsSchema, transform, CoreContext, toSettings } from '@skmtc/core'
import type { OperationGateway, ParseReturn, RefName } from '@skmtc/core'
import type { OperationInsertable, ModelInsertable, GeneratedValue } from '@skmtc/core'
import { handleEnrichment, type HandleEnrichmentArgs } from './handleEnrichment.ts'

const postSettingsBody = z.object({
  defaultSelected: z.boolean().optional(),
  schema: z.string(),
  clientSettings: settingsSchema.optional()
})

const postEnrichmentsBody = z.object({
  schema: z.string()
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

  app.post('/enrichments', async c => {
    return await Sentry.startSpan({ name: 'POST /enrichments' }, async span => {
      const body = await c.req.json()

      const { schema } = postEnrichmentsBody.parse(body)

      const { oasDocument } = toOasDocument({
        schema,
        spanId: span.spanContext().spanId
      })

      const operationEnrichmentRequests = generators
        .filter(generator => generator.type === 'operation')
        .flatMap(generator => {
          return oasDocument.operations.flatMap(operation => {
            return generator.toEnrichmentRequests?.(operation)
          })
        })

      const modelEnrichmentRequests = generators
        .filter(generator => generator.type === 'model')
        .flatMap(generator => {
          return Object.entries(oasDocument.components?.schemas ?? {}).flatMap(
            ([refName, schema]) => {
              return generator.toEnrichmentRequests?.(refName as RefName)
            }
          )
        })

      const enrichmentRequests = [...operationEnrichmentRequests, ...modelEnrichmentRequests]

      const enrichmentResponses = await Promise.all(
        enrichmentRequests
          .filter(request => request !== undefined)
          .map(request => handleEnrichment(request as HandleEnrichmentArgs))
      )

      return c.json({ enrichmentResponses })
    })
  })

  app.post('/settings', async c => {
    return await Sentry.startSpan({ name: 'POST /settings' }, async span => {
      const body = await c.req.json()

      const { clientSettings, defaultSelected = false, schema } = postSettingsBody.parse(body)

      const { oasDocument, extensions } = toOasDocument({
        schema,
        spanId: span.spanContext().spanId
      })

      return c.json({
        generators: toSettings({ generators, clientSettings, defaultSelected, oasDocument }),
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
