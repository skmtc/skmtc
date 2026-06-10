import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toTagsV3 } from '@/oas/tag/toTagsV3.ts'
import { toOperationsV3 } from '@/oas/operation/toOperationsV3.ts'
import { toComponentsV3 } from '@/oas/components/toComponentsV3.ts'
import { toInfoV3 } from '@/oas/info/toInfoV3.ts'
import type { DocumentFields } from '@/oas/document/Document.ts'
import { toSpecificationExtensionsV3 } from '@/oas/specificationExtensions/toSpecificationExtensionsV3.ts'
import { toOptionalServersV3 } from '@/oas/server/toServerV3.ts'
import { toSecurityRequirementsV3 } from '@/oas/securityRequirement/toSecurityRequirement.ts'
import { toExternalDocs } from '@/oas/externalDocs/toExternalDocs.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToDocumentV3Args = {
  documentObject: OpenAPIV3.Document
  stackTrail: StackTrail
  context: ParseContextType
}

export const toDocumentFieldsV3 = ({
  documentObject,
  stackTrail,
  context
}: ToDocumentV3Args): DocumentFields => {
  const { openapi, info, paths, components, tags, servers, security, externalDocs, ...skipped } =
    documentObject

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: documentObject,
    context,
    stackTrail,
    parentType: 'document'
  })

  return {
    openapi,
    info: stackTrail.trace('info', st => toInfoV3({ info, stackTrail: st, context })),
    servers: stackTrail.trace('servers', st =>
      toOptionalServersV3({ servers, stackTrail: st, context })
    ),
    operations: stackTrail.trace('paths', st => toOperationsV3({ paths, stackTrail: st, context })),
    components: stackTrail.trace('components', st =>
      toComponentsV3({ components, stackTrail: st, context })
    ),
    tags: stackTrail.trace('tags', st => toTagsV3({ tags, stackTrail: st, context })),
    security: stackTrail.trace('security', st =>
      toSecurityRequirementsV3({ security, stackTrail: st, context })
    ),
    extensionFields,
    externalDocs: stackTrail.trace('externalDocs', st =>
      toExternalDocs({ externalDocs, stackTrail: st, context })
    )
  }
}

// stackTrail.trace('info', (x) => formatNumber(x))
