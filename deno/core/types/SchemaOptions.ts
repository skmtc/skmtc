import type { OasSchema } from '../oas/schema/Schema.ts'
import * as v from 'valibot'

export type SchemaOption = {
  type: 'input' | 'formatter'
  name: string
  matchBy: {
    schema: OasSchema
    name?: string
  }
  exportPath: string
}

export const schemaOption = v.object({
  type: v.union([v.literal('input'), v.literal('formatter')]),
  name: v.string(),
  matchBy: v.object({
    schema: v.record(v.string(), v.unknown()),
    name: v.optional(v.string())
  }),
  exportPath: v.string()
})

export const serializedSchema: v.GenericSchema<SerializedSchema> = v.union([
  v.object({
    type: v.literal('object'),
    properties: v.optional(
      v.record(
        v.string(),
        v.lazy(() => serializedSchema)
      )
    )
  }),
  v.object({
    type: v.literal('string')
  }),
  v.object({
    type: v.literal('number')
  }),
  v.object({
    type: v.literal('boolean')
  }),
  v.object({
    type: v.literal('array'),
    items: v.lazy(() => serializedSchema)
  }),
  v.object({
    type: v.literal('integer')
  }),
  v.object({
    type: v.literal('integer')
  })
])

export type SerializedSchema =
  | {
      type: 'object'
      properties?: Record<string, SerializedSchema>
    }
  | {
      type: 'string'
    }
  | {
      type: 'number'
    }
  | {
      type: 'boolean'
    }
  | {
      type: 'array'
      items: SerializedSchema
    }
  | {
      type: 'integer'
    }
  | {
      type: 'boolean'
    }

export const serializedSchemaOption = v.object({
  type: v.union([v.literal('input'), v.literal('formatter')]),
  name: v.string(),
  exportPath: v.string(),
  matchBy: v.object({
    schema: serializedSchema,
    name: v.optional(v.string())
  })
})

export type SerializedSchemaOption = {
  type: 'input' | 'formatter'
  name: string
  exportPath: string
  matchBy: {
    schema: SerializedSchema
    name?: string
  }
}
