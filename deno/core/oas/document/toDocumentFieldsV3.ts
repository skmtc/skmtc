import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toTagsV3 } from '../tag/toTagsV3.ts'
import { toOperationsV3 } from '../operation/toOperationsV3.ts'
import { toComponentsV3 } from '../components/toComponentsV3.ts'
import { toInfoV3 } from '../info/toInfoV3.ts'
import type { DocumentFields } from './Document.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toOptionalServersV3 } from '../server/toServerV3.ts'
import { toSecurityRequirementsV3 } from '../securityRequirement/toSecurityRequirement.ts'
import { tracer } from '@/helpers/tracer.ts'
import { toExternalDocs } from '../externalDocs/toExternalDocs.ts'
type ToDocumentV3Args = {
  documentObject: OpenAPIV3.Document
  context: ParseContext
}

export const toDocumentFieldsV3 = ({
  documentObject,
  context
}: ToDocumentV3Args): DocumentFields => {
  const { openapi, info, paths, components, tags, servers, security, externalDocs, ...skipped } =
    documentObject

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: documentObject,
    context,
    parentType: 'document'
  })

  return {
    openapi,
    info: tracer(context.stackTrail, 'info', () => toInfoV3({ info, context })),
    servers: tracer(context.stackTrail, 'servers', () => toOptionalServersV3({ servers, context })),
    operations: tracer(context.stackTrail, 'paths', () => toOperationsV3({ paths, context })),
    components: tracer(context.stackTrail, 'components', () =>
      toComponentsV3({ components, context })
    ),
    tags: tracer(context.stackTrail, 'tags', () => toTagsV3({ tags, context })),
    security: tracer(context.stackTrail, 'security', () =>
      toSecurityRequirementsV3({ security, context })
    ),
    extensionFields,
    externalDocs: tracer(context.stackTrail, 'externalDocs', () =>
      toExternalDocs({ externalDocs, context })
    )
  }
}
