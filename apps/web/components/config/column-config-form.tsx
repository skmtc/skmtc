import * as React from 'react'
import { PathInput } from '@/components/ui/path-input'
import { OpenAPIV3 } from 'openapi-types'
import { FormatterSelect } from '@/components/formatter-select'
import { Input } from '@/components/ui/standard-input'
import { standardInput } from '@/lib/classes'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { useArtifacts } from '@/components/artifacts/artifacts-context'
import { OperationPreview } from '@skmtc/core/Preview'

export type ColumnConfigItem = {
  accessorPath: string[]
  formatter: string
  label: string
}

type ColumnConfigFormProps = {
  configSchema: OpenAPIV3.SchemaObject | null
  listItemName: string | null
  column?: ColumnConfigItem
  close: () => void
  source: OperationPreview
}

export function ColumnConfigForm({
  configSchema,
  listItemName,
  column,
  close,
  source
}: ColumnConfigFormProps) {
  const { state, dispatch } = useArtifacts()

  const [selectedSchema, setSelectedSchema] = React.useState<OpenAPIV3.SchemaObject | null>(null)

  const { control, handleSubmit, ...form } = useForm<ColumnConfigItem>({
    defaultValues: column ?? {
      accessorPath: [],
      formatter: '',
      label: ''
    }
  })

  if (!configSchema) {
    return null
  }

  return (
    <form
      className="flex flex-col gap-2 px-2 pt-2"
      onSubmit={handleSubmit(values => {
        console.log('SUBMIT', values)

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
              parentName={listItemName}
              schema={configSchema}
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
            <Input className={standardInput} {...field} />
          </div>
        )}
      />
      <div className="flex justify-end gap-4 pt-2">
        <Button
          variant="ghost"
          className="px-2 py-1 h-auto text-indigo-600 hover:text-indigo-700"
          onClick={() => close()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="px-2 py-1 h-auto bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Add
        </Button>
      </div>
    </form>
  )
}
