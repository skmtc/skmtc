import type { OpenAPIV3 } from 'openapi-types'
import { match } from 'ts-pattern'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useState } from 'react'

type Formatter = {
  schema: OpenAPIV3.SchemaObject
  label: string
}

const numberFormatter: Formatter = {
  schema: {
    type: 'number'
  },
  label: 'Number'
}

const textFormatter: Formatter = {
  schema: {
    type: 'string'
  },
  label: 'Text'
}

const nameFormatter: Formatter = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      forename: { type: 'string' },
      surname: { type: 'string' }
    }
  },
  label: 'Name'
}

const addressFormatter: Formatter = {
  schema: {
    type: 'object',
    properties: {
      buildingName: { type: 'string' },
      buildingNumber: { type: 'string' },
      line1: { type: 'string' },
      line2: { type: 'string' },
      line3: { type: 'string' },
      line4: { type: 'string' },
      postcode: { type: 'string' },
      country: { type: 'string' }
    }
  },
  label: 'Address'
}

const formatters: Formatter[] = [numberFormatter, textFormatter, nameFormatter, addressFormatter]

type FormatterSelectProps = {
  selectedSchema: OpenAPIV3.SchemaObject | null
}

export const FormatterSelect = ({ selectedSchema }: FormatterSelectProps) => {
  const formatterOptions = selectedSchema
    ? formatters
        .filter(formatter => {
          return isSchemaSubset({
            parentSchema: selectedSchema,
            childSchema: formatter.schema,
            topSchema: selectedSchema
          })
        })
        .map(formatter => ({
          value: formatter.label,
          label: formatter.label
        }))
    : []

  return (
    <Select disabled={!selectedSchema}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Format" />
      </SelectTrigger>
      <SelectContent>
        {formatterOptions.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type CompareSchemaArgs = {
  parentSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  childSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
  topSchema: OpenAPIV3.SchemaObject
}
export const isSchemaSubset = ({
  parentSchema,
  childSchema,
  topSchema
}: CompareSchemaArgs): boolean => {
  if (!childSchema) {
    return false
  }

  if (isRef(parentSchema)) {
    parentSchema = resolveRef(parentSchema, topSchema)
  }

  if (isRef(childSchema)) {
    childSchema = resolveRef(childSchema, topSchema)
  }

  return match(parentSchema)
    .with({ type: 'string' }, () => {
      return childSchema.type === 'string'
    })
    .with({ type: 'number' }, () => {
      return childSchema.type === 'number' || childSchema.type === 'integer'
    })
    .with({ type: 'integer' }, () => {
      return childSchema.type === 'integer'
    })
    .with({ type: 'boolean' }, () => {
      return childSchema.type === 'boolean'
    })
    .with({ type: 'array' }, ({ items }) => {
      return (
        childSchema.type === 'array' &&
        isSchemaSubset({
          parentSchema: items,
          childSchema: childSchema?.items,
          topSchema
        })
      )
    })

    .with({ type: 'object' }, () => {
      if (childSchema.type !== 'object') {
        return false
      }

      const parentPropertyEntries = Object.entries(parentSchema?.properties || {})

      for (const [key, value] of parentPropertyEntries) {
        if (parentSchema.required?.includes(key)) {
          if (!childSchema?.properties || !(key in childSchema.properties)) {
            return false
          }

          if (!childSchema.required?.includes(key)) {
            return false
          }

          if (
            !isSchemaSubset({
              parentSchema: value,
              childSchema: childSchema.properties[key],
              topSchema
            })
          ) {
            return false
          }
        } else {
          if (
            childSchema?.properties?.[key] &&
            !isSchemaSubset({
              parentSchema: value,
              childSchema: childSchema.properties[key],
              topSchema
            })
          ) {
            return false
          }
        }
      }

      return true
    })
    .otherwise(() => {
      return false
    })
}

const isRef = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): schema is OpenAPIV3.ReferenceObject => {
  return schema && '$ref' in schema
}

const toRefNames = ({ $ref }: OpenAPIV3.ReferenceObject) => {
  const [_, refPath] = $ref.split('#')

  if (!refPath) {
    throw new Error(`Invalid reference: "${$ref}"`)
  }

  return refPath.split('/').filter(Boolean)
}

const resolveRef = (ref: OpenAPIV3.ReferenceObject, topSchema: OpenAPIV3.SchemaObject) => {
  const refNames = toRefNames(ref)

  return refNames.reduce((acc, refName) => {
    if (!(refName in acc)) {
      throw new Error(`Reference "${ref.$ref}" not found in schema`)
    }
    // deno-lint-ignore ban-ts-comment
    // @ts-expect-error
    return acc[refName] as unknown as OpenAPIV3.SchemaObject
  }, topSchema)
}
