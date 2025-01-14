import * as React from 'react'
import { Input } from '@/components/ui/standard-input'
import { standardInput } from '@/lib/classes'
import { Controller, useForm } from 'react-hook-form'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { OperationPreview } from '@skmtc/core/Preview'
import { FormSectionItem, SchemaItem } from '@/components/config/types'
import { ConfigFormContainer } from '@/components/config/config-form-container'

type FormSectionFormProps = {
  schemaItem: SchemaItem
  section?: FormSectionItem
  close: () => void
  source: OperationPreview
}

export function FormSectionForm({ schemaItem, section, close, source }: FormSectionFormProps) {
  const { state, dispatch } = useArtifacts()

  const { control, handleSubmit } = useForm<FormSectionItem>({
    defaultValues: section ?? {
      title: '',
      fields: []
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
          type: 'add-form-section',
          payload: {
            source,
            formSection: values
          }
        })

        close()
      })}
    >
      <Controller
        name="title"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <label htmlFor="path-input" className="text-xs font-normal text-foreground">
              Title
            </label>
            <Input className={standardInput} {...field} />
          </div>
        )}
      />
    </ConfigFormContainer>
  )
}
