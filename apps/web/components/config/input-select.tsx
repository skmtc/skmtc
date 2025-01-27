import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/standard-select'
import { isAssignable } from '@/lib/isAssignable'
import { useEffect } from 'react'
import { inputClasses } from '@/lib/classes'
import { cn } from '@/lib/utils'
import { inputEdgeClasses } from '@/lib/classes'
import { SelectedSchemaType } from '@/components/config/types'
import type { InputOption } from '@skmtc/core/Preview'
import { useArtifacts } from '@/components/preview/artifacts-context'
import type { OpenAPIV3 } from 'openapi-types'
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

const marketingConsentInput: InputOption = {
  schema: {
    type: 'string'
  },
  name: 'marketingConsent',
  label: 'MarketingConsentInput'
}

const inputs: InputOption[] = [
  numberInput,
  textInput,
  nameInput,
  addressInput,
  marketingConsentInput
]

type InputSelectProps = {
  selectedSchema: SelectedSchemaType | null
  value: string | undefined
  fullSchema: OpenAPIV3.Document
  setValue: (value: string) => void
}

export const InputSelect = ({ selectedSchema, fullSchema, value, setValue }: InputSelectProps) => {
  const { state: artifactsState } = useArtifacts()
  const { manifest } = artifactsState

  const allInputOptions = Object.values(manifest?.previews ?? {})
    .flatMap(previewGroup => Object.values(previewGroup ?? {}))
    .map(({ input }) => input)
    .filter(input => typeof input !== 'undefined')

  const inputOptions = selectedSchema
    ? allInputOptions
        .concat(inputs)
        .filter(input => {
          const schemaMatches = isAssignable({
            to: input.schema,
            from: selectedSchema.schema,
            path: [],
            fullSchema
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
    if (
      (!value || !inputOptions.some(option => option.value === value)) &&
      inputOptions.length === 1
    ) {
      setValue(inputOptions[0].value)
    }
  }, [inputOptions, value])

  return (
    <Select disabled={!selectedSchema} value={value} onValueChange={setValue}>
      <SelectTrigger className={cn(inputClasses, inputEdgeClasses, 'h-7')}>
        <SelectValue placeholder="Format" />
      </SelectTrigger>
      <SelectContent>
        {inputOptions?.length ? (
          inputOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))
        ) : (
          <SelectItem disabled value="none">
            No inputs found
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
