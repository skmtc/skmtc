/**
 * Unified discriminated union for parse-time issues across both OAS and
 * GraphQL parsing. Each variant stands on its own — no shared base —
 * so TypeScript narrows cleanly on `protocol` and `level`.
 *
 * `cause?: unknown` is only present on the error variants. Warnings and
 * `debug` issues are synthesized by the parser with all the information
 * needed for the `message`; errors usually wrap a thrown `Error`, which
 * we keep in `cause` for debugging without forcing renderers to know
 * about it.
 *
 * Three severities: `error` (broken — drives exit status), `warning` (a
 * real deviation that was handled, e.g. a 3.0 schema missing `type`), and
 * `debug` (informational — the parser handled the input gracefully and
 * recorded what it assumed or dropped; spec-legal-but-lossy or
 * dialect-benign cases live here). All three are recorded on the manifest;
 * consumers filter `debug` out of the default view.
 *
 * `location` is the schema-level address of the issue: for OAS it's the
 * stringified stack trail (e.g. `components.schemas.User.properties.email`);
 * for GraphQL it's the schema-level address used by the GQL parser
 * (e.g. `Query.getUser.return`).
 */

import * as v from 'valibot'
import type { OasIssueType } from '@/context/generateTypes.ts'

/**
 * Categories of issues recorded during GraphQL → OAS mapping.
 *
 * Kept narrow on purpose. Extend only when a new lossy/diagnostic
 * code path is added — open-ended categories rot fast.
 *
 * - `NESTED_LIST_LOSSY` — `[[T]]` collapsed to `OasUnknown`.
 * - `UNKNOWN_TYPE_KIND` — defensive fallback for an unrecognized
 *   GraphQL type type. Should never fire in practice.
 * - `DROPPED_DIRECTIVE` — applied directive ignored during mapping
 *   (other than `@deprecated`, whose `reason` we capture).
 * - `SKIPPED_FIELD_ARGUMENTS` — non-root object/interface field
 *   carries arguments we don't model. Surfaces as a list of arg
 *   names so the user can see what's lost.
 * - `SKIPPED_FEATURE` — catch-all for other GraphQL features that
 *   don't translate (schema-level directive definitions, type
 *   extensions, etc.).
 * - `INVALID_TYPE_DEFINITION` — a top-level named type (object,
 *   input, interface, union, scalar, enum) threw during parse. The
 *   type is dropped from the registry and the wrapped error rides
 *   along as `cause`. Mirrors the role of OAS's `INVALID_SCHEMA` at
 *   the component layer.
 * - `INVALID_DEPENDENCY_REF` — a field, union member, or interface
 *   implementer references a type that failed to parse, and the
 *   consumer was pruned by `removeErroredItems`. Mirrors OAS's
 *   identically-named issue.
 */
export type GqlIssueType =
  | 'NESTED_LIST_LOSSY'
  | 'UNKNOWN_TYPE_KIND'
  | 'DROPPED_DIRECTIVE'
  | 'SKIPPED_FIELD_ARGUMENTS'
  | 'SKIPPED_FEATURE'
  | 'INVALID_TYPE_DEFINITION'
  | 'INVALID_DEPENDENCY_REF'

/**
 * Valibot schema for {@link GqlIssueType}. Annotation deliberately
 * omitted so the precise literal-union output type flows through to
 * consumers; drift between this list and {@link GqlIssueType} is
 * caught by the compile-time assertion below.
 */
export const gqlIssueType = v.union([
  v.literal('NESTED_LIST_LOSSY'),
  v.literal('UNKNOWN_TYPE_KIND'),
  v.literal('DROPPED_DIRECTIVE'),
  v.literal('SKIPPED_FIELD_ARGUMENTS'),
  v.literal('SKIPPED_FEATURE'),
  v.literal('INVALID_TYPE_DEFINITION'),
  v.literal('INVALID_DEPENDENCY_REF')
])

const _gqlIssueTypeDriftCheck: v.GenericSchema<GqlIssueType> = gqlIssueType
void _gqlIssueTypeDriftCheck

export type ParseIssue =
  | {
      protocol: 'oas'
      level: 'error'
      type: OasIssueType
      location: string
      message: string
      cause?: unknown
    }
  | {
      protocol: 'oas'
      level: 'warning'
      type: OasIssueType
      location: string
      message: string
    }
  | {
      protocol: 'oas'
      level: 'debug'
      type: OasIssueType
      location: string
      message: string
    }
  | {
      protocol: 'gql'
      level: 'error'
      type: GqlIssueType
      location: string
      message: string
      cause?: unknown
    }
  | {
      protocol: 'gql'
      level: 'warning'
      type: GqlIssueType
      location: string
      message: string
    }
  | {
      protocol: 'gql'
      level: 'debug'
      type: GqlIssueType
      location: string
      message: string
    }
