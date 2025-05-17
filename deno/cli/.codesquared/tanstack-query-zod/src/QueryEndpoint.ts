import type { Stringable, OperationInsertableArgs, FunctionParameter, ListArray } from '@skmtc/core'
import { List } from '@skmtc/core'
import { type EnrichmentSchema, TanstackQueryBase } from './base.ts'
import { QueryFn } from './QueryFn.ts'

export class QueryEndpoint extends TanstackQueryBase {
  parameter: FunctionParameter
  queryFnName: string
  queryTags: ListArray<Stringable>
  constructor({ context, operation, settings }: OperationInsertableArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    const queryFn = this.insertOperation(QueryFn, operation)

    this.parameter = queryFn.toValue().parameter
    this.queryFnName = queryFn.toName()

    const operationTags: Stringable[] = operation.tags?.map(tag => `'${tag}'`) ?? []

    this.queryTags = List.toArray(operationTags.concat(this.parameter.toPropertyList().values))

    this.register({
      imports: {
        react: ['useEffect'],
        '@tanstack/react-query': ['useQuery']
      }
    })
  }

  override toString(): string {
    return `(${this.parameter}) => {
      const result = useQuery({
        queryKey: ${this.queryTags},
        queryFn: () => ${this.queryFnName}(${this.parameter.toInbound()})
      })

      useEffect(() => {
        if(result.isError) {
          console.log('ERROR', result.error)
        }
      }, [])

      return result
    }`
  }
}
