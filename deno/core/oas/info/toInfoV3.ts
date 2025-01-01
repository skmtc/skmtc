import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasInfo } from './Info.ts'
import { toContactV3 } from '../contact/toContactV3.ts'
import { toLicenseV3 } from '../license/toLicenseV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToInfoV3Args = {
  info: OpenAPIV3.InfoObject
  context: ParseContext
}

export const toInfoV3 = ({ info, context }: ToInfoV3Args): OasInfo => {
  const { title, description, termsOfService, contact, license, version, ...skipped } = info

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  return new OasInfo({
    title,
    description,
    termsOfService,
    contact: contact ? toContactV3(contact, context) : undefined,
    license: license ? toLicenseV3(license, context) : undefined,
    version,
    extensionFields
  })
}
