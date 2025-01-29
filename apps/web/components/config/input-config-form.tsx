import * as React from 'react'
import { PathInput } from '@/components/ui/path-input'
import { Controller, useForm } from 'react-hook-form'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { OperationPreview } from '@skmtc/core/Preview'
import { FormatterSelect } from '@/components/config/formatter-select'
import { InputOptionConfigItem, SchemaItem, SelectedSchemaType } from '@/components/config/types'
import { ConfigFormContainer } from '@/components/config/config-form-container'
import { cn } from '@/lib/utils'
import invariant from 'tiny-invariant'
import { resolveSchemaItem } from '@/lib/schemaFns'

type InputConfigFormProps = {
  schemaItem: SchemaItem
  column?: InputOptionConfigItem
  close: () => void
  source: OperationPreview
}

export function InputConfigForm({ schemaItem, column, close, source }: InputConfigFormProps) {
  const { state: artifactsState, dispatch } = useArtifacts()

  const { parsedSchema } = artifactsState

  invariant(parsedSchema, 'Parsed schema is not set')

  const [selectedSchema, setSelectedSchema] = React.useState<SelectedSchemaType | null>(null)

  const { control, handleSubmit } = useForm<InputOptionConfigItem>({
    defaultValues: column ?? {
      accessorPath: [],
      formatter: ''
    }
  })

  if (!schemaItem) {
    return null
  }

  return (
    <ConfigFormContainer
      onCancel={close}
      onSubmit={handleSubmit(values => {
        dispatch({
          type: 'add-input-option',
          payload: {
            source,
            inputOption: values
          }
        })

        close()
      })}
    >
      <Controller
        name="accessorPath"
        control={control}
        render={({ field }) => {
          return (
            <div className="flex flex-col gap-1">
              <label htmlFor="path-input" className="text-xs font-normal text-foreground">
                Content
              </label>
              <PathInput
                path={field.value}
                setPath={field.onChange}
                schemaItem={resolveSchemaItem({ parsedSchema, schemaItem })}
                parsedSchema={parsedSchema}
                setSelectedSchema={setSelectedSchema}
              />
            </div>
          )
        }}
      />
      <Controller
        name="formatter"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <label htmlFor="path-input" className="text-xs font-normal text-foreground">
              Format
            </label>
            <FormatterSelect
              selectedSchema={selectedSchema}
              value={field.value}
              setValue={field.onChange}
              fullSchema={parsedSchema}
            />
          </div>
        )}
      />
    </ConfigFormContainer>
  )
}
