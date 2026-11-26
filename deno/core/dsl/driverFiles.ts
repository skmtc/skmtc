import type { FindDefinitionArgs, GenerateContextType } from '@/context/generateTypes.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import type { Lang } from '@/dsl/Lang.ts'
import { normalizeWorkspacePath, type WorkspacePath } from '@/helpers/normalizeWorkspacePath.ts'

/** The file an import goes into: the file when it exists, its normalized path when it does not yet. */
export type ImportDestination = FileBase | WorkspacePath

type ToImportDestinationArgs = {
  context: GenerateContextType
  /** The file the imported symbol is declared in. */
  exportPath: WorkspacePath
  /** The file that uses the symbol, as a generator spelled it. */
  destinationPath: string | undefined
}

/**
 * Where an import from `exportPath` goes, or `undefined` when it goes
 * nowhere: there is no destination, or the destination is `exportPath`'s own
 * file, where the symbol is in scope. Creates nothing: {@link toImportFile}
 * creates the file once the import is wanted.
 */
export const toImportDestination = ({
  context,
  exportPath,
  destinationPath
}: ToImportDestinationArgs): ImportDestination | undefined => {
  if (!destinationPath || destinationPath === exportPath) {
    return undefined
  }

  const file = context.getFile(destinationPath)

  if (file !== undefined) {
    return file.path === exportPath ? undefined : file
  }

  const path = normalizeWorkspacePath(destinationPath)

  return path === exportPath ? undefined : path
}

type ToImportFileArgs = {
  context: GenerateContextType
  lang: Lang
  destination: ImportDestination
}

/** The file of `destination`, created through `lang` if it does not exist yet. */
export const toImportFile = ({ context, lang, destination }: ToImportFileArgs): FileBase =>
  typeof destination === 'string' ? ensureFile({ context, lang, path: destination }) : destination

type EnsureFileArgs = {
  context: GenerateContextType
  lang: Lang
  path: WorkspacePath
}

/** The file at `path`, created through `lang` on first write. */
export const ensureFile = ({ context, lang, path }: EnsureFileArgs): FileBase =>
  context.getFileByWorkspacePath(path) ??
  context.addFile(lang.createFile({ path, settings: context.settings }))

type FindDefinitionAtArgs = Omit<FindDefinitionArgs, 'exportPath'> & {
  context: GenerateContextType
  exportPath: WorkspacePath
}

/**
 * {@link GenerateContextType.findDefinition} for a normalized export path: a
 * definition is in a file, so with no file at the path there is none, and
 * the path is not normalized again to find that out.
 */
export const findDefinitionAt = ({
  context,
  ...args
}: FindDefinitionAtArgs): DefinitionBase | undefined =>
  context.getFileByWorkspacePath(args.exportPath) === undefined
    ? undefined
    : context.findDefinition(args)
