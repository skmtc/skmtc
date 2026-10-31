import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toTagsV3 } from '@/parse/v3-1/tag/toTagsV3.ts'
import { toOperationsV3 } from '@/parse/v3-1/operation/toOperationsV3.ts'
import { toWebhooksV3, type WebhooksObject } from '@/parse/v3-1/webhook/toWebhooksV3.ts'
import { toComponentsV3 } from '@/parse/v3-1/components/toComponentsV3.ts'
import { toInfoV3 } from '@/parse/v3-1/info/toInfoV3.ts'
import type { DocumentFields } from '@/oas/document/Document.ts'
import { toSpecificationExtensionsV3 } from '@/parse/v3-1/specificationExtensions/toSpecificationExtensionsV3.ts'
import { toOptionalServersV3 } from '@/parse/v3-1/server/toServerV3.ts'
import { toSecurityRequirementsV3 } from '@/parse/v3-1/securityRequirement/toSecurityRequirement.ts'
import { toExternalDocs } from '@/parse/v3-1/externalDocs/toExternalDocs.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { toOperationsWithValidSecurity, toSecurityCheck } from '@/parse/securityRequirements.ts'

export type ToDocumentV3Args = {
  // Native 3.1 plumbing. The base 3.0 type has no `webhooks` and makes
  // `paths` required, but 3.1 adds top-level `webhooks` (parsed straight from
  // the raw document) and makes `paths` optional — a webhooks-only or
  // components-only document is valid. Widen both so the raw 3.1 document
  // type-checks.
  documentObject: Omit<OpenAPIV3.Document, 'paths'> & {
    paths?: OpenAPIV3.PathsObject
    webhooks?: WebhooksObject
  }
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

  const parsedInfo = stackTrail.trace('info', st => toInfoV3({ info, stackTrail: st, context }))
  const parsedServers = stackTrail.trace('servers', st =>
    toOptionalServersV3({ servers, stackTrail: st, context })
  )
  const parsedOperations = stackTrail.trace('paths', st =>
    toOperationsV3({ paths, stackTrail: st, context })
  )
  const parsedWebhooks = stackTrail.trace('webhooks', st =>
    toWebhooksV3({ webhooks, stackTrail: st, context })
  )
  const parsedComponents = stackTrail.trace('components', st =>
    toComponentsV3({ components, stackTrail: st, context })
  )
  const parsedTags = stackTrail.trace('tags', st => toTagsV3({ tags, stackTrail: st, context }))
  const securityCheck = stackTrail.trace('security', st =>
    toSecurityCheck({
      parse: () => toSecurityRequirementsV3({ security, stackTrail: st, context }),
      declared: components?.securitySchemes,
      parsed: parsedComponents?.securitySchemes,
      stackTrail: st,
      context
    })
  )

  return {
    openapi,
    info: parsedInfo,
    servers: parsedServers,
    operations: toOperationsWithValidSecurity({ items: parsedOperations, check: securityCheck }),
    webhooks: toOperationsWithValidSecurity({ items: parsedWebhooks, check: securityCheck }),
    components: parsedComponents,
    tags: parsedTags,
    security: securityCheck.rootSecurity,
    extensionFields,
    externalDocs: stackTrail.trace('externalDocs', st =>
      toExternalDocs({ externalDocs, stackTrail: st, context })
    )
  }
}

// stackTrail.trace('info', (x) => formatNumber(x))
