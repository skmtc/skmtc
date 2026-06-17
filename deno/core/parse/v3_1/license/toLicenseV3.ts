import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { OasLicense } from '@/oas/license/License.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export const toLicenseV3 = (
  license: OpenAPIV3.LicenseObject,
  stackTrail: StackTrail,
  context: ParseContextType
): OasLicense => {
  const { name, url, ...skipped } = license

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: license,
    context,
    stackTrail,
    parentType: 'license'
  })

  return new OasLicense({
    name,
    url,
    extensionFields
  })
}
