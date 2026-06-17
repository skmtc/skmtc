import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toTagsV3 } from '@/parse/v3_0/tag/toTagsV3.ts'
import { toOperationsV3 } from '@/parse/v3_0/operation/toOperationsV3.ts'
import { toWebhooksV3, type WebhooksObject } from '@/parse/v3_0/webhook/toWebhooksV3.ts'
import { toComponentsV3 } from '@/parse/v3_0/components/toComponentsV3.ts'
import { toInfoV3 } from '@/parse/v3_0/info/toInfoV3.ts'
import type { DocumentFields } from '@/oas/document/Document.ts'
import { toSpecificationExtensionsV3 } from '@/parse/v3_0/specificationExtensions/toSpecificationExtensionsV3.ts'
import { toOptionalServersV3 } from '@/parse/v3_0/server/toServerV3.ts'
import { toSecurityRequirementsV3 } from '@/parse/v3_0/securityRequirement/toSecurityRequirement.ts'
import { toExternalDocs } from '@/parse/v3_0/externalDocs/toExternalDocs.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToDocumentV3Args = {
  // Retained-member transport: 3.1 webhooks ride on the down-converted 3.0
  // document (see @skmtc/convert `toV3Document` + `retainWebhooks`). The base
  // 3.0 type has no `webhooks`, so widen it here.
  documentObject: OpenAPIV3.Document & { webhooks?: WebhooksObject }
  stackTrail: StackTrail
  context: ParseContextType
}

export const toDocumentFieldsV3 = ({
  documentObject,
  stackTrail,
  context
}: ToDocumentV3Args): DocumentFields => {
  const {
    openapi,
    info,
    paths,
    components,
    tags,
    servers,
    security,
    externalDocs,
    webhooks,
    ...skipped
  } = documentObject

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
    webhooks: stackTrail.trace('webhooks', st =>
      toWebhooksV3({ webhooks, stackTrail: st, context })
    ),
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
