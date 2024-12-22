import * as Sentry from '@sentry/deno'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { clientSettings as settingsSchema, transform, CoreContext } from '@skmtc/core'
import type { OperationGateway, OasDocument, ParseReturn } from '@skmtc/core'
import type {
  Method,
  OperationInsertable, 
  ModelInsertable,
  GeneratedValue,
  ClientGeneratorSettings
} from '@skmtc/core'

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

      const out: ClientGeneratorSettings[] = generators.map(generator => {
        const generatorSettings = clientSettings?.generators.find(({ id }) => id === generator.id)

        const generatorType = generator.type

        return match(generatorType)
          .with('operation', () => {
            if (!generatorSettings) {
              return {
                id: generator.id,
                operations: toOperations({
                  generator: generator as OperationGateway,
                  oasDocument,
                  defaultSelected,
                  operationsSettings: undefined
                })
              }
            }

            return {
              ...generatorSettings,
              id: generator.id,
              operations: toOperations({
                generator: generator as OperationGateway,
                oasDocument,
                defaultSelected,
                operationsSettings:
                  'operations' in generatorSettings ? generatorSettings.operations : undefined
              })
            }
          })
          .with('model', () => {
            if (!generatorSettings) {
              return {
                id: generator.id,
                models: toModels({
                  oasDocument,
                  defaultSelected,
                  modelsSettings: undefined
                })
              }
            }

            return {
              ...generatorSettings,
              id: generator.id,
              models: toModels({
                oasDocument,
                defaultSelected,
                modelsSettings: 'models' in generatorSettings ? generatorSettings.models : undefined
              })
            }
          })
          .otherwise(matched => {
            throw new Error(`Invalid generator type: '${matched}' for ${generator.id}`)
          })
      })

      return c.json({ generators: out, extensions })
    })
  })

  return app
}

type ToModelsArgs = {
  defaultSelected: boolean
  oasDocument: OasDocument
  modelsSettings: Record<string, boolean> | undefined
}

const toModels = ({ defaultSelected, oasDocument, modelsSettings }: ToModelsArgs) => {
  return Object.fromEntries(
    Object.keys(oasDocument.components?.schemas ?? {}).map(refName => [
      refName,
      modelsSettings?.[refName] ? modelsSettings?.[refName] : defaultSelected
    ])
  )
}

type ToOperationsArgs = {
  generator: OperationGateway
  oasDocument: OasDocument
  defaultSelected: boolean
  operationsSettings: Record<string, Partial<Record<Method, boolean>>> | undefined
}

type OperationSettings = Record<string, Record<Method, boolean>>

const toOperations = ({
  generator,
  oasDocument,
  operationsSettings,
  defaultSelected
}: ToOperationsArgs) => {
  return Object.values(oasDocument.operations)
    .filter(operation => generator.isSupported(operation))
    .reduce<OperationSettings>((acc, operation) => {
      const { path, method } = operation

      acc[path] = acc[path] ?? {}

      acc[path][method] = operationsSettings?.[path]?.[method]
        ? operationsSettings?.[path]?.[method]
        : defaultSelected

      return acc
    }, {})
}

type ToOasDocumentArgs = {
  schema: string
  spanId: string
}

const toOasDocument = ({ schema, spanId }: ToOasDocumentArgs): ParseReturn => {
  const context = new CoreContext({ spanId })

  return context.parse(schema)
}
