import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'
import { OasLicense } from './License.js'

export const toLicenseV3 = (
  license: OpenAPIV3.LicenseObject,
  context: ParseContext
): OasLicense => {
  const { name, url, ...skipped } = license

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  return new OasLicense({
    name,
    url,
    extensionFields
  })
}
