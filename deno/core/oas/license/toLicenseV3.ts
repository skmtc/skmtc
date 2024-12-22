import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
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
    context
  })

  return new OasLicense({
    name,
    url,
    extensionFields
  })
}
