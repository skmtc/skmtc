import { CreateSchemaBodyFileUpdate } from '@/types/createSchemaBodyFileUpdate.generated.ts'

export type PatchSchemaBody = {
  id?: string | undefined
  name?: string | undefined
  slug?: string | undefined
  schemaId?: string | undefined
  file?: CreateSchemaBodyFileUpdate | undefined
}
