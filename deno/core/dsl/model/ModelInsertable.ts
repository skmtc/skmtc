import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { RefName } from '../../types/RefName.ts'
import type { Identifier } from '../Identifier.ts'

type ModelInsertableConstructorArgs = {
  context: GenerateContext
  refName: RefName
  settings: ContentSettings
  destinationPath: string
}

export type WithTransformModel = {
  transformModel: (refName: RefName) => void
}

export type ModelInsertable<V> = { prototype: V } & {
  new ({ context, refName, settings, destinationPath }: ModelInsertableConstructorArgs): V
  id: string
  type: 'model'
  _class: 'ModelInsertable'

  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string

  isSupported: () => boolean

  pinnable: boolean

  // deno-lint-ignore ban-types
} & Function
