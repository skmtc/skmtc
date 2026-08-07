import { toSchemaSource } from '@/lib/schema-file.ts'
import { isAbsolute } from '@std/path/is-absolute'
import { join } from '@std/path/join'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { SchemaFile, type RemoteBudget } from '@/lib/schema-file.ts'
import type { SchemaSource } from '@/lib/types.ts'

export const toSchemaContents = async (
  schemaSourceString: string,
  budget?: RemoteBudget
): Promise<{ contents: string; schemaSource: SchemaSource }> => {
  const schemaSource = toSchemaSource(schemaSourceString)

  if (schemaSource.type === 'local' && !isAbsolute(schemaSource.path)) {
    schemaSource.path = join(toAbsoluteRootPath(), schemaSource.path)
  }

  return await SchemaFile.getFromSource(schemaSource, budget)
}
