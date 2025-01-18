import * as React from 'react'
import { PathInput } from '@/components/ui/path-input'
import { OpenAPIV3 } from 'openapi-types'
import { Input } from '@/components/ui/standard-input'
import { inputClasses, inputEdgeClasses } from '@/lib/classes'
import { Controller, useForm } from 'react-hook-form'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { OperationPreview } from '@skmtc/core/Preview'
import { FormatterSelect } from '@/components/config/formatter-select'
import { ColumnConfigItem, SchemaItem } from '@/components/config/types'
import { ConfigFormContainer } from '@/components/config/config-form-container'
import { cn } from '@/lib/utils'

type ColumnConfigFormProps = {
  schemaItem: SchemaItem
  column?: ColumnConfigItem
  close: () => void
  source: OperationPreview
}

export function ColumnConfigForm({ schemaItem, column, close, source }: ColumnConfigFormProps) {
  const { state, dispatch } = useArtifacts()

  const [selectedSchema, setSelectedSchema] = React.useState<OpenAPIV3.SchemaObject | null>(null)

  const { control, handleSubmit } = useForm<ColumnConfigItem>({
    defaultValues: column ?? {
      accessorPath: [],
      formatter: '',
      label: ''
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
          type: 'add-column-config',
          payload: {
            source,
            columnConfig: values
          }
        })

        close()
      })}
    >
      <Controller
        name="accessorPath"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <label htmlFor="path-input" className="text-xs font-normal text-foreground">
              Content
            </label>
            <PathInput
              path={field.value}
              setPath={field.onChange}
              schemaItem={schemaItem}
              setSelectedSchema={setSelectedSchema}
            />
          </div>
        )}
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
            />
          </div>
        )}
      />
      <Controller
        name="label"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <label htmlFor="path-input" className="text-xs font-normal text-foreground">
              Label
            </label>
            <Input className={cn(inputClasses, inputEdgeClasses)} {...field} />
          </div>
        )}
      />
    </ConfigFormContainer>
  )
}
