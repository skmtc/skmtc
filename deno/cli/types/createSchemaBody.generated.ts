import { CreateSchemaBodyUrl } from '@/types/createSchemaBodyUrl.generated.ts'
import { CreateSchemaBodyFile } from '@/types/createSchemaBodyFile.generated.ts'
import { CreateSchemaBodyTypespec } from '@/types/createSchemaBodyTypespec.generated.ts'

export type CreateSchemaBody =
  | CreateSchemaBodyUrl
  | CreateSchemaBodyFile
  | CreateSchemaBodyTypespec
