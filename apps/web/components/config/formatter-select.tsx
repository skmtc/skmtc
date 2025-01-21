import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/standard-select'
import { isSchemaSubset } from '@/lib/isSchemaSubset'
import { useEffect } from 'react'
import { inputClasses } from '@/lib/classes'
import { cn } from '@/lib/utils'
import { inputEdgeClasses } from '@/lib/classes'
import { SelectedSchemaType } from '@/components/config/types'
import type { FormatterOption } from '@skmtc/core/Preview'

const numberFormatter: FormatterOption = {
  schema: {
    type: 'number'
  },
  label: 'NumberFormatter'
}

const textFormatter: FormatterOption = {
  schema: {
    type: 'string'
  },
  label: 'TextFormatter'
}

const nameFormatter: FormatterOption = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      forename: { type: 'string' },
      surname: { type: 'string' }
    }
  },
  label: 'NameFormatter'
}

const addressFormatter: FormatterOption = {
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
  label: 'AddressFormatter'
}

const formatters: FormatterOption[] = [
  numberFormatter,
  textFormatter,
  nameFormatter,
  addressFormatter
]

type FormatterSelectProps = {
  selectedSchema: SelectedSchemaType | null
  value: string | undefined
  setValue: (value: string) => void
}

export const FormatterSelect = ({ selectedSchema, value, setValue }: FormatterSelectProps) => {
  const formatterOptions = selectedSchema
    ? formatters
        .filter(formatter => {
          return isSchemaSubset({
            parentSchema: selectedSchema.schema,
            childSchema: formatter.schema,
            topSchema: selectedSchema.schema
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
      <SelectTrigger className={cn(inputClasses, inputEdgeClasses)}>
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
