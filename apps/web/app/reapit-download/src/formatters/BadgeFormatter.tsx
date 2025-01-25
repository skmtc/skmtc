import { Badge } from '@reapit/elements'
import { UseQueryResult } from '@tanstack/react-query'

type BadgesFormatterProps<Model extends { id: string; name: string }, Args extends { id: string[] }> = {
  args: Args
  useGetQuery: (args: Args) => UseQueryResult<PaginatedResult<Model>, Error>
}

type PaginatedResult<Model> = {
  _embedded: Model[]
}

export const BadgesFormatter = <Model extends { id: string; name: string }, Args extends { id: string[] }>({
  args,
  useGetQuery,
}: BadgesFormatterProps<Model, Args>) => {
  const { data } = useGetQuery(args)

  return (
    <>
      {data?._embedded?.length
        ? data._embedded.map((model) => (
            <Badge intent="primary" key={model.id}>
              {model.name}
            </Badge>
          ))
        : 'Unknown'}
    </>
  )
}
