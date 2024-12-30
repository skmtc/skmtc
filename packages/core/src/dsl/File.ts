import { Import } from './Import.js'
import type { Definition } from './Definition.js'
import type { GeneratorKey } from '../types/GeneratorKeys.js'
import type { ClientSettings, ModulePackage } from '../types/Settings.js'

type FileArgs = {
  path: string
  settings: ClientSettings | undefined
}

export class File {
  path: string
  reExports: Map<string, Record<string, Set<string>>>
  imports: Map<string, Set<string>>
  definitions: Map<string, Definition>
  #generatorKeys: Set<GeneratorKey>
  packages: ModulePackage[] | undefined

  constructor({ path, settings }: FileArgs) {
    this.path = path
    this.reExports = new Map()
    this.imports = new Map()
    this.definitions = new Map()
    this.#generatorKeys = new Set()
    this.packages = settings?.packages
  }

  get generatorKeys() {
    return this.#generatorKeys
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

  return destinationPath.startsWith(rootPath) ? exportPath.replace(rootPath, '@') : moduleName
}
