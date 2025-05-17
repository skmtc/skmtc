import {
  type OperationInsertableArgs,
  List,
  type ListArray,
  type RefName
} from '@skmtc/core'
import { MutationFn } from './MutationFn.ts'
import { type EnrichmentSchema, TanstackQueryBase } from './base.ts'
import { TsInsertable } from '@skmtc/typescript'

export class MutationEndpoint extends TanstackQueryBase {
  tags: ListArray<string>
  mutationFnName: string
  requestBodyTsName: string
  constructor({
    context,
    operation,
    settings
  }: OperationInsertableArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.tags = List.toArray(operation.tags?.map((tag) => `'${tag}'`) ?? [])

    this.mutationFnName = this.insertOperation(MutationFn, operation).toName()

    const response = operation?.toRequestBody(({ schema }) => schema)

    this.requestBodyTsName = this.insertModel(
      TsInsertable,
      response?.isRef() ? response.toRefName() : ('none' as RefName)
    ).toName()

    this.register({
      imports: {
        '@tanstack/react-query': ['useMutation', 'useQueryClient'],
        zod: ['z']
      }
    })
  }

  override toString(): string {
    return `() => {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: ${this.mutationFnName},
        onSuccess: () => {
          // Invalidate and refetch
          void queryClient.invalidateQueries({ queryKey: ${this.tags}})
        }
      })
    }`
  }
}
