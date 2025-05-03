import { Import } from './Import.ts'
import type { Definition } from './Definition.ts'
import type { ClientSettings, ModulePackage } from '../types/Settings.ts'

type FileArgs = {
  path: string
  settings: ClientSettings | undefined
}

export class File {
  fileType: 'ts' = 'ts'
  path: string
  reExports: Map<string, Record<string, Set<string>>>
  imports: Map<string, Set<string>>
  definitions: Map<string, Definition>
  packages: ModulePackage[] | undefined

  constructor({ path, settings }: FileArgs) {
    this.path = path
    this.reExports = new Map()
    this.imports = new Map()
    this.definitions = new Map()
    this.packages = settings?.packages
  }

  toString() {
    const reExports = Array.from(this.reExports.entries()).flatMap(([module, entityTypes]) => {
      const updatedModuleName = normaliseModuleName({
        destinationPath: this.path,
        exportPath: module,
        packages: this.packages
      })

      return Object.entries(entityTypes).map(([entityType, names]) => {
        const prefix = entityType === 'type' ? 'type' : ''

        return `export ${prefix} { ${Array.from(names).join(', ')} } from '${updatedModuleName}'`
      })
    })

    const imports = Array.from(this.imports.entries()).map(([module, importItems]) => {
      const updatedModuleName = this.packages
        ? normaliseModuleName({
            destinationPath: this.path,
            exportPath: module,
            packages: this.packages
          })
        : module

      return new Import({ module: updatedModuleName, importNames: Array.from(importItems) })
    })

    const definitions = Array.from(this.definitions.values())

    return [reExports, imports, definitions]
      .filter(section => Boolean(section.length))
      .map(section => section.join('\n'))
      .join('\n\n')
  }
}

export type NormaliseModuleNameArgs = {
  destinationPath: string
  exportPath: string
  packages: ModulePackage[] | undefined
}

export const normaliseModuleName = ({
  destinationPath,
  exportPath,
  packages = []
}: NormaliseModuleNameArgs) => {
  const matchingModule = packages.find(packageModule => {
    return exportPath.startsWith(packageModule.rootPath)
  })

  if (!matchingModule) {
    return exportPath
  }

  const { rootPath, moduleName } = matchingModule

  // When importing from within same package, truncate the root path and denote root with '@'
  if (destinationPath.startsWith(rootPath)) {
    return exportPath.replace(rootPath, '@')
  }

  if (!moduleName) {
    throw new Error(`Module name is not set for ${rootPath}`)
  }

  return moduleName
}
