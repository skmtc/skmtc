import { isPlainObject } from '@/parse/isPlainObject.ts'
import {
  isRef,
  toRawRefTarget,
  toRefParts,
  toRefPathBucket,
  toRefPointer,
  toSchemaComponentRef,
  isRemoteRefPath,
  type RefParts
} from '@/helpers/refFns.ts'
import type { RefName } from '@/types/RefName.ts'

/** Keywords whose value is data, so a `$ref` inside it is not a reference. */
const DATA_KEYWORDS = ['default', 'example', 'examples', 'enum', 'const']

/** Keywords whose value is a map of names to schemas: a name in it is not a keyword. */
const SCHEMA_MAP_KEYWORDS = ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']

type RawRef = { $ref: string }

/** A `$ref` inside a schema, and the key of the schema it points at. */
type GraphEdge = { ref: RawRef; target: string }

/** Every `$ref` object anywhere inside a raw schema. */
const toSchemaRefs = (value: unknown): RawRef[] => {
  if (Array.isArray(value)) {
    return value.flatMap(toSchemaRefs)
  }

  if (!isPlainObject(value)) {
    return []
  }

  const nested = Object.entries(value).flatMap(([key, child]) => {
    if (DATA_KEYWORDS.includes(key) || key.startsWith('x-')) {
      return []
    }

    return SCHEMA_MAP_KEYWORDS.includes(key) && isPlainObject(child)
      ? Object.values(child).flatMap(toSchemaRefs)
      : toSchemaRefs(child)
  })

  return isRef(value) ? [value, ...nested] : nested
}

/** Every `$ref` object anywhere in a raw document. */
const toDocumentRefs = (value: unknown): RawRef[] => {
  if (Array.isArray(value)) {
    return value.flatMap(toDocumentRefs)
  }

  if (!isPlainObject(value)) {
    return []
  }

  const nested = Object.values(value).flatMap(toDocumentRefs)

  return isRef(value) ? [value, ...nested] : nested
}

/** Whether a ref can point at a schema: not a remote one, and not one to another kind of component. */
const canNameSchema = ({ refName, refPath }: RefParts): boolean => {
  const bucket = toRefPathBucket(refPath)

  return refName !== '' && !isRemoteRefPath(refPath) && (bucket === undefined || bucket === 'schemas')
}

/** The document's schema ref graph: each schema component and each other ref target, by `toRefPointer`, with the refs inside it. */
const toRefGraph = (document: unknown): Map<string, GraphEdge[]> => {
  const components = isPlainObject(document) ? document.components : undefined
  const schemas = isPlainObject(components) ? components.schemas : undefined
  const names = isPlainObject(schemas) ? Object.keys(schemas) : []

  const graph = new Map<string, GraphEdge[]>()
  const pending: RefParts[] = [
    ...names.map(name => toSchemaComponentRef(name as RefName)),
    ...toDocumentRefs(document).map(({ $ref }) => toRefParts({ $ref }))
  ]

  // `pending` grows while it is walked: each target may hold refs to more targets.
  for (const parts of pending) {
    const key = toRefPointer(parts)

    if (graph.has(key) || !canNameSchema(parts)) {
      continue
    }

    const edges = toSchemaRefs(toRawRefTarget(document, parts)).map(ref => ({
      ref,
      parts: toRefParts({ $ref: ref.$ref })
    }))

    graph.set(key, edges.map(edge => ({ ref: edge.ref, target: toRefPointer(edge.parts) })))
    edges.forEach(edge => pending.push(edge.parts))
  }

  return graph
}

type Visit = { index: number; low: number }
type Frame = { node: string; edges: GraphEdge[]; next: number }

/**
 * The strongly connected set of each node, as a number (Tarjan). Iterative, so
 * a long chain of refs does not run out of stack.
 */
const toConnectedSets = (graph: Map<string, GraphEdge[]>): Map<string, number> => {
  const visits = new Map<string, Visit>()
  const open: string[] = []
  const sets = new Map<string, number>()

  const enter = (node: string): Frame => {
    visits.set(node, { index: visits.size, low: visits.size })
    open.push(node)

    return { node, edges: graph.get(node) ?? [], next: 0 }
  }

  for (const root of graph.keys()) {
    if (visits.has(root)) {
      continue
    }

    const frames = [enter(root)]

    for (let frame = frames.at(-1); frame !== undefined; frame = frames.at(-1)) {
      const visit = visits.get(frame.node)
      const edge = frame.edges[frame.next]

      if (visit === undefined) {
        break
      }

      if (edge !== undefined) {
        frame.next += 1
        const seen = visits.get(edge.target)

        if (seen === undefined) {
          frames.push(enter(edge.target))
        } else if (!sets.has(edge.target)) {
          visit.low = Math.min(visit.low, seen.index)
        }

        continue
      }

      frames.pop()
      const caller = frames.at(-1)
      const parent = caller && visits.get(caller.node)

      if (parent) {
        parent.low = Math.min(parent.low, visit.low)
      }

      if (visit.low === visit.index) {
        const id = visit.index

        open.splice(open.lastIndexOf(frame.node)).forEach(node => sets.set(node, id))
      }
    }
  }

  return sets
}

/**
 * The `$ref` objects of a raw document that are in a cycle: the ref's target
 * leads back, through any refs, to a schema that holds the ref. A ref inside a
 * deep ref target is held by that target and by the schema around it.
 *
 * The answer depends on the document only, not on where a parse enters it.
 */
export const toCyclicRefs = (document: unknown): WeakSet<object> => {
  const graph = toRefGraph(document)
  const sets = toConnectedSets(graph)

  return new WeakSet(
    [...graph].flatMap(([holder, edges]) =>
      edges.filter(({ target }) => sets.get(target) === sets.get(holder)).map(({ ref }) => ref)
    )
  )
}
