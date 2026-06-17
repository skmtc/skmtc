import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { OasContact } from '@/oas/contact/Contact.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export const toContactV3 = (
  contact: OpenAPIV3.ContactObject,
  stackTrail: StackTrail,
  context: ParseContextType
): OasContact => {
  const { name, url, email, ...skipped } = contact

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: contact,
    context,
    stackTrail,
    parentType: 'contact'
  })

  return new OasContact({
    name,
    url,
    email,
    extensionFields
  })
}
