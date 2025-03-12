import { KeyPath } from '@/components/forms/types.ts'
import { Input } from '@/components/ui/input.tsx'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form.tsx'
import { FieldValues, useFormContext } from 'react-hook-form'

type IntegerFieldProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  fieldName: Key
  label?: string
  placeholder?: string
}

export const IntegerField = <Model extends FieldValues, Key extends KeyPath<Model>>({
  label,
  fieldName,
  placeholder
}: IntegerFieldProps<Model, Key>) => {
  const { control } = useFormContext<Model>()

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem className="flex flex-col gap-2 px-px">
          {typeof label === 'string' && <FormLabel htmlFor={fieldName}>{label}</FormLabel>}
          <FormControl>
            <Input
              type="text"
              value={isNaN(value) || value === 0 ? '' : value.toString()}
              onChange={event => {
                const output = parseInt(event.target.value)
                onChange(isNaN(output) ? 0 : output)
              }}
              placeholder={placeholder}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
