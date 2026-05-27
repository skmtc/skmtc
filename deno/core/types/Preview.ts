/**
 * @fileoverview Preview and Mapping System for SKMTC Core
 *
 * Types and Valibot schemas for the preview and mapping systems. Generators
 * may emit a {@link PreviewModule} and/or a {@link MappingModule} per
 * operation or model; the dispatcher pairs each module with a `*Source`
 * descriptor so tooling can trace generated code back to its origin in the
 * source schema.
 *
 * ## Source descriptors
 *
 * The `source` discriminated union narrows on `type`:
 *
 * - `oasOperation` — carries `operationPath` and `operationMethod` (HTTP)
 * - `gqlOperation` — carries `rootKind` and `fieldName` (GraphQL)
 * - `model` — carries `refName` (protocol-neutral)
 *
 * @example Building an OAS operation source
 * ```typescript
 * import type { OasOperationSource } from '@skmtc/core/Preview';
 *
 * const source: OasOperationSource = {
 *   type: 'oasOperation',
 *   generatorId: 'react-forms',
 *   operationPath: '/users',
 *   operationMethod: 'post'
 * };
 * ```
 *
 * @example Building a GraphQL operation source
 * ```typescript
 * import type { GqlOperationSource } from '@skmtc/core/Preview';
 *
 * const source: GqlOperationSource = {
 *   type: 'gqlOperation',
 *   generatorId: 'react-forms',
 *   rootKind: 'mutation',
 *   fieldName: 'createUser'
 * };
 * ```
 *
 * @example Building a model source
 * ```typescript
 * import type { ModelSource } from '@skmtc/core/Preview';
 *
 * const source: ModelSource = {
 *   type: 'model',
 *   generatorId: 'typescript-types',
 *   refName: 'User',
 *   variant: 'main'
 * };
 * ```
 *
 * @example Pairing a module with a source
 * ```typescript
 * import type { Preview, PreviewModule } from '@skmtc/core/Preview';
 *
 * const module: PreviewModule = {
 *   name: 'CreateUserForm',
 *   exportPath: './generated/forms/CreateUserForm.tsx',
 *   group: 'forms'
 * };
 *
 * const preview: Preview = { module, source };
 * ```
 *
 * @module Preview
 */

import { method, type Method } from './Method.ts'
import type { GqlRootKind } from '@/gql/operation/GqlOperation.ts'
import * as v from 'valibot'

export type OasOperationSource = {
  type: 'oasOperation'
  generatorId: string
  operationPath: string
  operationMethod: Method
  /**
   * Operation variant the artifact was emitted for. `'main'` for
   * variants-unaware generators and for single-variant projects; one
   * of the consumer-named variant keys otherwise (see {@link Variant}).
   */
  variant: string
}

export type GqlOperationSource = {
  type: 'gqlOperation'
  generatorId: string
  rootKind: GqlRootKind
  fieldName: string
  /**
   * Operation variant the artifact was emitted for (see {@link Variant}).
   */
  variant: string
}

export type ModelSource = {
  type: 'model'
  generatorId: string
  refName: string
  /**
   * Model variant the artifact was emitted for. `'main'` for
   * variants-unaware generators and for single-variant projects; one
   * of the consumer-named variant keys otherwise (see {@link Variant}).
   */
  variant: string
}

export type PreviewModule = {
  name: string
  exportPath: string
}

export type MappingModule = {
  name: string
  exportPath: string
  schema: string
}

export type Preview = {
  module: PreviewModule
  source: OasOperationSource | GqlOperationSource | ModelSource
}

export type Mapping = {
  module: MappingModule
  source: OasOperationSource | GqlOperationSource | ModelSource
}

/**
 * Valibot schema for validating OAS operation source objects.
 *
 * Validates the `oasOperation` source variant — type, generator ID,
 * operation path, and HTTP method. See {@link gqlOperationSource} for the
 * GraphQL counterpart.
 */
export const oasOperationSource: v.ObjectSchema<
  {
    readonly type: v.LiteralSchema<'oasOperation', undefined>
    readonly generatorId: v.StringSchema<undefined>
    readonly operationPath: v.StringSchema<undefined>
    readonly operationMethod: v.UnionSchema<
      [
        v.LiteralSchema<'get', undefined>,
        v.LiteralSchema<'post', undefined>,
        v.LiteralSchema<'put', undefined>,
        v.LiteralSchema<'patch', undefined>,
        v.LiteralSchema<'delete', undefined>,
        v.LiteralSchema<'head', undefined>,
        v.LiteralSchema<'options', undefined>,
        v.LiteralSchema<'trace', undefined>
      ],
      undefined
    >
    readonly variant: v.StringSchema<undefined>
  },
  undefined
> = v.object({
  type: v.literal('oasOperation'),
  generatorId: v.string(),
  operationPath: v.string(),
  operationMethod: method,
  variant: v.string()
})

/**
 * Valibot schema for validating GraphQL operation source objects.
 *
 * Sibling to {@link oasOperationSource} for the GraphQL protocol — validates
 * `rootKind` and `fieldName` instead of `path` / `method`.
 */
export const gqlOperationSource: v.ObjectSchema<
  {
    readonly type: v.LiteralSchema<'gqlOperation', undefined>
    readonly generatorId: v.StringSchema<undefined>
    readonly rootKind: v.PicklistSchema<['query', 'mutation', 'subscription'], undefined>
    readonly fieldName: v.StringSchema<undefined>
    readonly variant: v.StringSchema<undefined>
  },
  undefined
> = v.object({
  type: v.literal('gqlOperation'),
  generatorId: v.string(),
  rootKind: v.picklist(['query', 'mutation', 'subscription']),
  fieldName: v.string(),
  variant: v.string()
})

/**
 * Valibot schema for validating model source objects.
 *
 * Validates model source structures including type, generator ID,
 * and reference name information.
 */
export const modelSource: v.ObjectSchema<
  {
    readonly type: v.LiteralSchema<'model', undefined>
    readonly generatorId: v.StringSchema<undefined>
    readonly refName: v.StringSchema<undefined>
    readonly variant: v.StringSchema<undefined>
  },
  undefined
> = v.object({
  type: v.literal('model'),
  generatorId: v.string(),
  refName: v.string(),
  variant: v.string()
})

/**
 * Valibot schema for validating preview module objects.
 *
 * Validates preview module structures: name, export path, and group.
 */
export const previewModule: v.GenericSchema<PreviewModule> = v.object({
  name: v.string(),
  exportPath: v.string()
})

/**
 * Valibot schema for validating mapping module objects.
 *
 * Validates mapping module structures: name, export path, group, item type
 * (`'input'` | `'formatter'`), and schema reference.
 */
export const mappingModule: v.GenericSchema<MappingModule> = v.object({
  name: v.string(),
  exportPath: v.string(),
  schema: v.string()
})

const source: v.VariantSchema<
  'type',
  [typeof oasOperationSource, typeof gqlOperationSource, typeof modelSource],
  undefined
> = v.variant('type', [oasOperationSource, gqlOperationSource, modelSource])

/**
 * Valibot schema for validating preview objects.
 *
 * Validates complete preview structures including module and source information.
 */
export const preview: v.GenericSchema<Preview> = v.object({
  module: previewModule,
  source: source
})

/**
 * Valibot schema for validating mapping objects.
 *
 * Validates complete mapping structures including module and source information.
 */
export const mapping: v.GenericSchema<Mapping> = v.object({
  module: mappingModule,
  source: source
})
