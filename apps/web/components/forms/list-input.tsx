import { FormItem, FormLabel } from '@/components/ui/form'
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import {
  ArrayPath,
  FieldArrayWithId,
  FieldValues,
  useFieldArray,
  UseFieldArrayRemove,
  useFormContext
} from 'react-hook-form'

export type RenderRowProps<Model extends FieldValues, Key extends ArrayPath<Model>> = {
  row: FieldArrayWithId<Model, Key>
  index: number
  remove: UseFieldArrayRemove
}

type ListInputProps<Model extends FieldValues, Key extends ArrayPath<Model>> = {
  label: string
  fieldName: Key
  headers: React.ReactNode[]
  itemName: string
  renderRow: ({ row, index, remove }: RenderRowProps<Model, Key>) => React.ReactNode
}

export const ListInput = <Model extends FieldValues, Key extends ArrayPath<Model>>({
  label,
  fieldName,
  headers,
  itemName,
  renderRow
}: ListInputProps<Model, Key>) => {
  const { control } = useFormContext<Model>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldName
  })

  return (
    <FormItem className="px-px">
      <FormLabel>{label}</FormLabel>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={index}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{fields.map((row, index) => renderRow({ row, index, remove }))}</TableBody>
      </Table>
      {/* @ts-ignore */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="gap-2 w-full"
        // @ts-ignore
        onClick={() => append({})}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        Add {itemName}
      </Button>
    </FormItem>
  )
}
