import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasInfo } from './Info.ts'
import { toContactV3 } from '../contact/toContactV3.ts'
import { toLicenseV3 } from '../license/toLicenseV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToInfoV3Args = {
  info: OpenAPIV3.InfoObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toInfoV3 = ({ info, stackTrail, context }: ToInfoV3Args): OasInfo => {
  const { title, description, termsOfService, contact, license, version, ...skipped } = info

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: info,
    context,
    stackTrail,
    parentType: 'info'
  })

  return new OasInfo({
    title,
    description,
    termsOfService,
    contact: contact ? toContactV3(contact, stackTrail, context) : undefined,
    license: license ? toLicenseV3(license, stackTrail, context) : undefined,
    version,
    extensionFields
  })
}
