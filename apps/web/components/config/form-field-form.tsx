import * as React from 'react'
import { Input } from '@/components/ui/standard-input'
import { Controller, useForm } from 'react-hook-form'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { OperationPreview } from '@skmtc/core/Preview'
import { PathInput } from '@/components/ui/path-input'
import { InputSelect } from '@/components/config/input-select'
import { FormFieldItem, SchemaItem, SelectedSchemaType } from '@/components/config/types'
import { ConfigFormContainer } from '@/components/config/config-form-container'
import { inputEdgeClasses } from '@/lib/classes'
import { inputClasses } from '@/lib/classes'
import { cn } from '@/lib/utils'

type FormFieldFormProps = {
  section?: FormFieldItem
  schemaItem: SchemaItem
  sectionIndex: number
  close: () => void
  source: OperationPreview
}

export function FormFieldForm({
  section,
  schemaItem,
  sectionIndex,
  close,
  source
}: FormFieldFormProps) {
  const { dispatch } = useArtifacts()

  const [selectedSchema, setSelectedSchema] = React.useState<SelectedSchemaType | null>(null)

  const { control, handleSubmit } = useForm<FormFieldItem>({
    defaultValues: section ?? {
      label: '',
      accessorPath: [],
      input: 'TextInput',
      placeholder: '',
      wrapper: 'InputWrap'
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
          type: 'add-form-field',
          payload: {
            source,
            formField: values,
            sectionIndex: sectionIndex
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
              showRequired={true}
            />
          </div>
        )}
      />
      <Controller
        name="input"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <label htmlFor="path-input" className="text-xs font-normal text-foreground">
              Input
            </label>
            <InputSelect
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
      <Controller
        name="placeholder"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <label htmlFor="path-input" className="text-xs font-normal text-foreground">
              Placeholder
            </label>
            <Input className={cn(inputClasses, inputEdgeClasses)} {...field} />
          </div>
        )}
      />
      <Controller
        name="wrapper"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <label htmlFor="path-input" className="text-xs font-normal text-foreground">
              Wrapper
            </label>
            <Input className={cn(inputClasses, inputEdgeClasses)} {...field} />
          </div>
        )}
      />
    </ConfigFormContainer>
  )
}
