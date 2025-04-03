import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { OasLicense } from './License.ts'

export const toLicenseV3 = (
  license: OpenAPIV3.LicenseObject,
  context: ParseContext
): OasLicense => {
  const { name, url, ...skipped } = license

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: license,
    context,
    parentType: 'license'
  })

  return new OasLicense({
    name,
    url,
    extensionFields
  })
}
