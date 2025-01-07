import { Table } from '@tanstack/react-table'
import { UseQueryResult } from '@tanstack/react-query'

type PaginationProps<Model, Response> = {
  table: Table<Model>
  dataQuery: UseQueryResult<Response, Error>
  rerender: () => void
}

export type Embedded<Model> = {
  _embedded: Model[]
}

export const Pagination = <Model, Response extends Embedded<Model>>({
  table,
  dataQuery,
  rerender
}: PaginationProps<Model, Response>) => (
  <div>
    <div className="h-2" />
    <div className="flex items-center gap-2">
      <button
        className="border rounded p-1"
        onClick={() => table.firstPage()}
        disabled={!table.getCanPreviousPage()}
      >
        {'<<'}
      </button>
      <button
        className="border rounded p-1"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        {'<'}
      </button>
      <button
        className="border rounded p-1"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        {'>'}
      </button>
      <button
        className="border rounded p-1"
        onClick={() => table.lastPage()}
        disabled={!table.getCanNextPage()}
      >
        {'>>'}
      </button>
      <span className="flex items-center gap-1">
        <div>Page</div>
        <strong>
          {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount().toLocaleString()}
        </strong>
      </span>
      <span className="flex items-center gap-1">
        | Go to page:
        <input
          type="number"
          defaultValue={table.getState().pagination.pageIndex + 1}
          onChange={e => {
            const page = e.target.value ? Number(e.target.value) - 1 : 0
            table.setPageIndex(page)
          }}
          className="border p-1 rounded w-16"
        />
      </span>
      <select
        value={table.getState().pagination.pageSize}
        onChange={e => {
          table.setPageSize(Number(e.target.value))
        }}
      >
        {[10, 20, 30, 40, 50].map(pageSize => (
          <option key={pageSize} value={pageSize}>
            Show {pageSize}
          </option>
        ))}
      </select>
      {dataQuery.isFetching ? 'Loading...' : null}
    </div>
    <div>
      Showing {table.getRowModel().rows.length.toLocaleString()} of{' '}
      {dataQuery.data?._embedded?.length.toLocaleString()} Rows
    </div>
    <div>
      <button onClick={() => rerender()}>Force Rerender</button>
    </div>
  </div>
)
