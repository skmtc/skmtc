import { toProjectPath } from '@/lib/to-project-path.ts'
import { toBundlePath } from '@/lib/to-bundle-path.ts'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { toClientJsonContents } from '@/lib/to-client-json-contents.ts'
import { toManifestPath } from '@/lib/to-manifest-path.ts'

type ToGenerateLocalArgsArgs = {
  projectName: string
  schemaSourceString: string | undefined
  watch: boolean | undefined
}

export const toGenerateLocalArgs = async ({
  projectName,
  schemaSourceString
}: ToGenerateLocalArgsArgs) => {
  const projectPath = toProjectPath(projectName)

  const clientJsonContents = toClientJsonContents(projectPath)

  if (schemaSourceString) {
    const schemaContents = await toSchemaContents(schemaSourceString)

    return {
      bundlePath: toBundlePath(projectPath),
      manifestPath: toManifestPath(projectPath),
      schemaContents: schemaContents.contents,
      fileType: schemaContents.fileType,
      clientSettings: clientJsonContents?.settings
    }
  }

  if (!clientJsonContents?.source) {
    return undefined
  }

  const schemaContents = await toSchemaContents(clientJsonContents.source)

  if (!schemaContents) {
    return undefined
  }

  return {
    bundlePath: toBundlePath(projectPath),
    manifestPath: toManifestPath(projectPath),
    schemaContents: schemaContents.contents,
    fileType: schemaContents.fileType,
    clientSettings: clientJsonContents.settings
  }
}
