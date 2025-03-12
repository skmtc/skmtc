import { KeyPath } from '@/components/forms/types.ts'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form.tsx'
import { FieldValues, useFormContext } from 'react-hook-form'
import { Textarea } from '@/components/ui/textarea.tsx'

type TextareaFieldProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  fieldName: Key
  label?: string
  placeholder?: string
}

export const TextareaField = <Model extends FieldValues, Key extends KeyPath<Model>>({
  label,
  fieldName,
  placeholder
}: TextareaFieldProps<Model, Key>) => {
  const { control } = useFormContext<Model>()

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field }) => (
        <FormItem className="flex flex-col flex-1 gap-2 px-px">
          {typeof label === 'string' && <FormLabel htmlFor={fieldName}>{label}</FormLabel>}
          <FormControl>
            <Textarea placeholder={placeholder} className="flex-1" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
