import * as Sentry from '@sentry/deno'
import { cors } from 'hono/cors'
import { z, createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { clientSettings as settingsSchema, transform } from '@skmtc/core'
import { operationPreview, modelPreview } from '@skmtc/core'
import { generateSettings } from './generateSettings.ts'
import type { GeneratorsMap, GeneratorType, OasRef, OasSchema } from '@skmtc/core'
import { toOasDocument } from './toOasDocument.ts'
import { manifestContent } from '@skmtc/core/Manifest'
import invariant from 'tiny-invariant'

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

const postArtifactConfigBody = z
  .object({
    schema: z.string(),
    clientSettings: settingsSchema,
    source: z.discriminatedUnion('type', [operationPreview, modelPreview])
  })
  .openapi('PostArtifactConfigRequestBody')

type CreateServerArgs = {
  toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<
    GeneratorType<EnrichmentType>,
    EnrichmentType
  >
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

const schemaItem = z
  .object({
    schema: z.object({}).passthrough(),
    name: z.string().nullable(),
    type: z.enum(['list-item', 'form-item'])
  })
  .openapi('SchemaItem')

const postArtifactConfigResponse = z
  .object({
    schemaItem: schemaItem.nullable()
  })
  .openapi('PostArtifactConfigResponse')

const postArtifactConfig = createRoute({
  method: 'post',
  path: '/artifact-config',
  request: {
    body: { content: { 'application/json': { schema: postArtifactConfigBody } } }
  },
  responses: {
    200: {
      description: 'Artifact config',
      content: { 'application/json': { schema: postArtifactConfigResponse } }
    }
  }
})

type OperationSchemaItem = {
  schema: OasSchema | OasRef<'schema'>
  type: 'list-item' | 'form-item'
}

export const createServer = ({ toGeneratorsMap, logsPath }: CreateServerArgs): OpenAPIHono => {
  const app = new OpenAPIHono()

  app.use('*', cors({ origin: '*' }))

  app.openapi(postArtifacts, async c => {
    const startAt = Date.now()

    const result = await Sentry.startSpan({ name: 'POST /artifacts' }, async span => {
      const { schema, clientSettings, prettier } = await Sentry.startSpan(
        { name: 'Parse JSON' },
        () => c.req.valid('json')
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

    return c.json(result, 200)
  })

  app.openapi(getGenerators, c => {
    return Sentry.startSpan({ name: 'GET /generators' }, () => {
      return c.json({ generators: Object.keys(toGeneratorsMap()) })
    })
  })

  app.openapi(postArtifactConfig, c => {
    return Sentry.startSpan({ name: 'POST /artifact-config' }, span => {
      const { schema, source } = c.req.valid('json')

      invariant(source.type === 'operation', 'Source must be an operation')

      const { oasDocument } = toOasDocument({
        schema,
        spanId: span.spanContext().spanId
      })

      const operation = oasDocument.operations.find(operation => {
        return (
          operation.method === source.operationMethod && operation.path === source.operationPath
        )
      })

      const generators = toGeneratorsMap()

      // deno-lint-ignore ban-ts-comment
      // @ts-expect-error
      const operationSchemaItem = generators[source.generatorId]?.toSchemaItem(
        operation
      ) as OperationSchemaItem

      if (!operationSchemaItem) {
        return c.json({ schemaItem: null }, 200)
      }

      const refName = operationSchemaItem.schema.isRef()
        ? operationSchemaItem.schema.toRefName()
        : null

      return c.json(
        {
          schemaItem: {
            schema: operationSchemaItem.schema.toJsonSchema({ resolve: true }) as Record<
              string,
              unknown
            >,
            name: refName,
            type: operationSchemaItem.type
          }
        },
        200
      )
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

  app.doc('/openapi', {
    openapi: '3.0.3',
    info: {
      title: 'SKMTC API',
      version: '0.0.1'
    }
  })

  return app
}
