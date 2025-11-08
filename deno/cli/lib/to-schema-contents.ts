import { toSchemaSource } from '@/lib/schema-file.ts'
import { isAbsolute } from '@std/path/is-absolute'
import { join } from '@std/path/join'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { SchemaFile } from '@/lib/schema-file.ts'

export const toSchemaContents = async (schemaSourceString: string): Promise<string> => {
  const schemaSource = toSchemaSource(schemaSourceString)

  if (schemaSource.type === 'local' && !isAbsolute(schemaSource.path)) {
    schemaSource.path = join(toAbsoluteRootPath(), schemaSource.path)
  }

  const { contents } = await SchemaFile.getFromSource(schemaSource)

  return contents
}
