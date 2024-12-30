import type {
  OperationGateway,
  OperationInsertable,
  ModelInsertable,
  GeneratedValue
} from '@skmtc/core'

export type GeneratorsType = (
  | OperationGateway
  | OperationInsertable<GeneratedValue>
  | ModelInsertable<GeneratedValue>
)[]
