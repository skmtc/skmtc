import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { OasContact } from './Contact.ts'

export const toContactV3 = (
  contact: OpenAPIV3.ContactObject,
  context: ParseContextType
): OasContact => {
  const { name, url, email, ...skipped } = contact

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: contact,
    context,
    parentType: 'contact'
  })

  return new OasContact({
    name,
    url,
    email,
    extensionFields
  })
}
