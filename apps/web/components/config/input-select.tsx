import type { OpenAPIV3 } from 'openapi-types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/standard-select'
import { isSchemaSubset } from '@/lib/isSchemaSubset'
import { standardInput } from '@/lib/classes'
import { useEffect, useState } from 'react'

type Input = {
  schema: OpenAPIV3.SchemaObject
  label: string
}

const numberInput: Input = {
  schema: {
    type: 'number'
  },
  label: 'NumberInput'
}

const textInput: Input = {
  schema: {
    type: 'string'
  },
  label: 'TextInput'
}

const nameInput: Input = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      forename: { type: 'string' },
      surname: { type: 'string' }
    }
  },
  label: 'NameInput'
}

const addressInput: Input = {
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
  label: 'AddressInput'
}

const formatters: Input[] = [numberInput, textInput, nameInput, addressInput]

type InputSelectProps = {
  selectedSchema: OpenAPIV3.SchemaObject | null
  value: string | undefined
  setValue: (value: string) => void
}

export const InputSelect = ({ selectedSchema, value, setValue }: InputSelectProps) => {
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

  // If no value is set and there is only one formatter, set the value to the formatter
  useEffect(() => {
    if (!value && formatterOptions.length === 1) {
      console.log('SETTING VALUE', formatterOptions[0].value)

      setValue(formatterOptions[0].value)
    }
  }, [formatterOptions, value])

  return (
    <Select disabled={!selectedSchema} value={value} onValueChange={setValue}>
      <SelectTrigger className={standardInput}>
        <SelectValue placeholder="Format" />
      </SelectTrigger>
      <SelectContent>
        {formatterOptions?.length ? (
          formatterOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))
        ) : (
          <SelectItem disabled value="none">
            No formatters found
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
