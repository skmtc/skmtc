import { DataTable } from '@/components/data-table/data-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColumnDef } from '@tanstack/react-table'

type TableCardProps<TData, TValue> = {
  search?: string
  setSearch?: (search: string) => void
  title: string | undefined
  description: string | undefined
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  addButton?: React.ReactNode
}

const TableCard = <TData, TValue>({
  search,
  setSearch,
  title,
  description,
  columns,
  data,
  addButton
}: TableCardProps<TData, TValue>) => {
  return (
    <Card x-chunk="dashboard-06-chunk-0" className="flex flex-col min-w-full">
      {(title || description) && (
        <CardHeader className="pb-0">
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="flex min-w-full">
        <DataTable
          addButton={addButton}
          columns={columns}
          data={data}
          search={search}
          setSearch={setSearch}
        />
      </CardContent>
    </Card>
  )
}

export default TableCard
