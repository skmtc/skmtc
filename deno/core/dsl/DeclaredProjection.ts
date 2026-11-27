import type { ToModelEnrichmentsArgs, ToModelExportPathArgs } from '@/dsl/model/types.ts'
import type {
  ToOasOperationEnrichmentsArgs,
  ToOasOperationExportPathArgs
} from '@/dsl/operation/oas/types.ts'
import type {
  ToGqlOperationEnrichmentsArgs,
  ToGqlOperationExportPathArgs
} from '@/dsl/operation/gql/types.ts'
import type { ToWebhookEnrichmentsArgs, ToWebhookExportPathArgs } from '@/dsl/webhook/types.ts'

/**
 * A model projection class as a generator's entry declares it: the statics
 * core can read before it constructs anything.
 *
 * The statics are methods, not function properties. TypeScript compares a
 * method's parameters both ways, so projection classes with different
 * enrichment and option types fit in one list.
 */
export type DeclaredModelProjection = {
  id: string
  type: 'model'
  toEnrichments(args: ToModelEnrichmentsArgs): unknown
  toExportPath(args: ToModelExportPathArgs<unknown, unknown>): string
}

/** An OpenAPI operation projection class as an entry declares it. See {@link DeclaredModelProjection}. */
export type DeclaredOasOperationProjection = {
  id: string
  type: 'oasOperation'
  toEnrichments(args: ToOasOperationEnrichmentsArgs): unknown
  toExportPath(args: ToOasOperationExportPathArgs<unknown, unknown>): string
}

/** A webhook projection class as an entry declares it. See {@link DeclaredModelProjection}. */
export type DeclaredWebhookProjection = {
  id: string
  type: 'webhook'
  toEnrichments(args: ToWebhookEnrichmentsArgs): unknown
  toExportPath(args: ToWebhookExportPathArgs<unknown, unknown>): string
}

/** A GraphQL operation projection class as an entry declares it. See {@link DeclaredModelProjection}. */
export type DeclaredGqlOperationProjection = {
  id: string
  type: 'gqlOperation'
  toEnrichments(args: ToGqlOperationEnrichmentsArgs): unknown
  toExportPath(args: ToGqlOperationExportPathArgs<unknown, unknown>): string
}

/**
 * A projection class in an entry's `projections` list.
 *
 * An entry lists every projection class its generator can insert: its own,
 * and each one of another generator that it inserts, such as the model
 * projection an operation generator takes its schemas from. From the list,
 * core can know before a run which files the generator can write.
 */
export type DeclaredProjection =
  | DeclaredModelProjection
  | DeclaredOasOperationProjection
  | DeclaredWebhookProjection
  | DeclaredGqlOperationProjection
