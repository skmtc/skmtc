import { KeyPath } from '@/components/inputs/types'
import { NumberInput } from '@/components/ui/number-input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form.tsx'
import { type FieldValues, useFormContext } from 'react-hook-form'

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
      render={({ field: { onChange, value, ...field } }) => (
        <FormItem className="flex flex-col gap-2 px-px">
          {typeof label === 'string' && <FormLabel htmlFor={fieldName}>{label}</FormLabel>}
          <FormControl>
            <NumberInput
              placeholder={placeholder}
              stepper={1}
              value={value}
              onValueChange={output => onChange(output)}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
