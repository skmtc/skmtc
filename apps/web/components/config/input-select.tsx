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
import type { InputOption } from '@skmtc/core/Preview'
import { useArtifacts } from '@/components/preview/artifacts-context'

const numberInput: InputOption = {
  schema: {
    type: 'number'
  },
  label: 'NumberInput'
}

const textInput: InputOption = {
  schema: {
    type: 'string'
  },
  label: 'TextInput'
}

const nameInput: InputOption = {
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

const addressInput: InputOption = {
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

const officeIdsInput: InputOption = {
  schema: {
    type: 'array',
    items: {
      type: 'string'
    }
  },
  label: 'OfficeIdsInput',
  name: 'officeIds'
}

const inputs: InputOption[] = [numberInput, textInput, nameInput, addressInput, officeIdsInput]

type InputSelectProps = {
  selectedSchema: SelectedSchemaType | null
  value: string | undefined
  setValue: (value: string) => void
}

export const InputSelect = ({ selectedSchema, value, setValue }: InputSelectProps) => {
  const { state: artifactsState } = useArtifacts()
  const { manifest } = artifactsState

  const inputOptions = Object.values(manifest?.previews ?? {})
    .flatMap(previewGroup => Object.values(previewGroup))
    .map(({ input }) => input)
    .filter(input => typeof input !== 'undefined')

  console.log('inputOptions', inputOptions)

  const formatterOptions = selectedSchema
    ? inputOptions
        .concat(inputs)
        .filter(input => {
          const schemaMatches = isSchemaSubset({
            parentSchema: selectedSchema.schema,
            childSchema: input.schema,
            topSchema: selectedSchema.schema
          })

          const nameMatches = input.name ? input.name === selectedSchema.name : true

          return schemaMatches && nameMatches
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
