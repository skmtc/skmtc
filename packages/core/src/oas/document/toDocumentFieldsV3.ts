import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { toTagsV3 } from '../tag/toTagsV3.js'
import { toOperationsV3 } from '../operation/toOperationsV3.js'
import { toComponentsV3 } from '../components/toComponentsV3.js'
import { toInfoV3 } from '../info/toInfoV3.js'
import type { DocumentFields } from './Document.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'
import { toOptionalServersV3 } from '../server/toServerV3.js'

type ToDocumentV3Args = {
  documentObject: OpenAPIV3.Document
  context: ParseContext
}

export const toDocumentFieldsV3 = ({
  documentObject,
  context
}: ToDocumentV3Args): DocumentFields => {
  const { openapi, info, paths, components, tags, servers, ...skipped } = documentObject

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  const fields: DocumentFields = {
    openapi,
    info: context.trace('info', () => toInfoV3({ info, context })),
    servers: context.trace('servers', () => toOptionalServersV3({ servers, context })),
    operations: context.trace('paths', () => toOperationsV3({ paths, context })),
    components: context.trace('components', () => toComponentsV3({ components, context })),
    tags: context.trace('tags', () => toTagsV3({ tags, context })),
    extensionFields
  }

  return fields
}
