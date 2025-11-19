import { toSchemaSource } from '@/lib/schema-file.ts'
import { isAbsolute } from '@std/path/is-absolute'
import { join } from '@std/path/join'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { SchemaFile } from '@/lib/schema-file.ts'
import type { FileType, SchemaSource } from '@/lib/types.ts'

export const toSchemaContents = async (
  schemaSourceString: string
): Promise<{ contents: string; schemaSource: SchemaSource; fileType: FileType }> => {
  const schemaSource = toSchemaSource(schemaSourceString)

  if (schemaSource.type === 'local' && !isAbsolute(schemaSource.path)) {
    schemaSource.path = join(toAbsoluteRootPath(), schemaSource.path)
  }

  return await SchemaFile.getFromSource(schemaSource)
}
