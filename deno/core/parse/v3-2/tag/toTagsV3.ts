import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasTag } from '@/oas/tag/Tag.ts'
import type { TagFields } from '@/oas/tag/Tag.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toExternalDocs } from '../externalDocs/toExternalDocs.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/** A 3.2 Tag Object: the 3.0 shape plus `summary`, `parent` and `kind`. */
export type TagObjectV32 = OpenAPIV3.TagObject & {
  summary?: string
  parent?: string
  kind?: string
}

export type ToTagsV3Args = {
  tags: TagObjectV32[] | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toTagsV3 = ({ tags, stackTrail, context }: ToTagsV3Args): OasTag[] | undefined => {
  if (!tags) {
    return undefined
  }

  const parents = new Map(tags.map(({ name, parent }) => [name, parent]))

  return tags.map(tag => {
    const parentError = toParentError({ name: tag.name, parent: tag.parent, parents })

    if (!parentError) {
      return toTagV3({ tag, stackTrail, context })
    }

    context.logIssue({
      key: 'parent',
      level: 'warning',
      message: `Tag '${tag.name}' ${parentError}; dropping 'parent'`,
      parent: tag,
      stackTrail,
      type: 'INVALID_TAG_PARENT'
    })

    return toTagV3({ tag: { ...tag, parent: undefined }, stackTrail, context })
  })
}

type ToParentErrorArgs = {
  name: string
  parent: string | undefined
  parents: Map<string, string | undefined>
}

/** Describes why the tag's `parent` is invalid, or returns undefined when it is valid. */
const toParentError = ({ name, parent, parents }: ToParentErrorArgs): string | undefined => {
  if (parent === undefined) {
    return undefined
  }

  if (!parents.has(parent)) {
    return `names parent '${parent}', which is not a tag`
  }

  if (leadsBackTo({ name, current: parent, parents, visited: new Set() })) {
    return `is in a parent cycle through '${parent}'`
  }

  return undefined
}

type LeadsBackToArgs = {
  name: string
  current: string | undefined
  parents: Map<string, string | undefined>
  visited: Set<string>
}

/** Follows the parent chain from `current` and reports whether it reaches `name`. */
const leadsBackTo = ({ name, current, parents, visited }: LeadsBackToArgs): boolean => {
  if (current === undefined) {
    return false
  }

  if (current === name) {
    return true
  }

  // The chain loops without reaching `name`: the cycle is above this tag, and
  // the tags in it report it.
  if (visited.has(current)) {
    return false
  }

  return leadsBackTo({
    name,
    current: parents.get(current),
    parents,
    visited: new Set([...visited, current])
  })
}

export type ToTagV3Args = {
  tag: TagObjectV32
  stackTrail: StackTrail
  context: ParseContextType
}

export const toTagV3 = ({ tag, stackTrail, context }: ToTagV3Args): OasTag => {
  const { name, description, summary, parent, kind, externalDocs, ...skipped } = tag

  const parsedExternalDocs = stackTrail.trace('externalDocs', st =>
    toExternalDocs({ externalDocs, stackTrail: st, context })
  )

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: tag,
    context,
    stackTrail,
    parentType: 'tag'
  })

  const fields: TagFields = {
    name,
    description,
    summary,
    parent,
    kind,
    externalDocs: parsedExternalDocs,
    extensionFields
  }

  return new OasTag(fields)
}
