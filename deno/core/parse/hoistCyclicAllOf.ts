import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toRefName } from '@/helpers/refFns.ts'

/**
 * Give every inline `allOf` that takes part in a reference cycle a name, by
 * hoisting it into `components.schemas` and leaving a `$ref` in its place.
 *
 * Why: `allOf` is eliminated at parse time by copying each base in. A named
 * schema that reaches itself again is fine — the parser flattens each
 * component once and refers to it by name after that. An INLINE `allOf`
 * has no name to refer to, so a document where `Child.properties.next` is
 * `{ allOf: [{ $ref: Parent }, …] }` and `Parent`'s union lists `Child`
 * would be copied into itself without end. Every other generator answers
 * a recursive structure the same way: it gets a name, and the recursion is
 * a reference to that name. This pass does exactly that, once, before the
 * parser runs, on the raw document — so the parser never has to notice.
 *
 * Only cyclic inline `allOf`s are hoisted; every other document comes back
 * as the same object, untouched. The name is the node's location in the
 * document with `~` between the frames (`Parent~properties~next`), which
 * is stable across parses and which `camelCase` turns into an identifier.
 */
export type Hoisted = {
  /** The document to parse — the input itself when nothing was hoisted. */
  document: OpenAPIV3.Document
  /** The names given to the hoisted `allOf`s, for the parse issues. */
  hoisted: string[]
}

export const hoistCyclicAllOf = (document: OpenAPIV3.Document): Hoisted => {
  const graph = toRefGraph(document)
  const cyclic = [...graph.inline.values()].filter(node => onCycle(node.id, graph))

  if (cyclic.length === 0) {
    return { document, hoisted: [] }
  }

  const hoisted: OpenAPIV3.Document = structuredClone(document)
  const names: string[] = []
  const schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject> = {
    ...(hoisted.components?.schemas ?? {})
  }

  // Deepest first, so hoisting a node does not move a node nested inside it
  // out from under the path we are about to rewrite.
  for (const node of [...cyclic].sort((a, b) => b.frames.length - a.frames.length)) {
    const name = toHoistedName(node.frames)
    const parent = at(hoisted, node.frames.slice(0, -1))
    const key = node.frames[node.frames.length - 1]

    if (parent === undefined || key === undefined) {
      continue
    }

    schemas[name] = parent[key] as OpenAPIV3.SchemaObject
    parent[key] = { $ref: `#/components/schemas/${name}` }
    names.push(name)
  }

  hoisted.components = { ...(hoisted.components ?? {}), schemas }

  return { document: hoisted, hoisted: names }
}

/** The name an inline node is hoisted under: its document path, minus `components/schemas`. */
export const toHoistedName = (frames: string[]): string => {
  const [first, second, ...rest] = frames
  const named = first === 'components' && second === 'schemas' ? rest : frames

  return named.map(frame => frame.replaceAll(/[~/]/g, '-')).join('~')
}

type Node = {
  /** `#/components/schemas/<name>` for a component, the frames joined for an inline node. */
  id: string
  frames: string[]
  edges: Set<string>
}

type RefGraph = {
  nodes: Map<string, Node>
  inline: Map<object, Node>
}

const componentId = (name: string) => `#/components/schemas/${name}`

const isInlineAllOf = (value: unknown): value is OpenAPIV3.SchemaObject =>
  value !== null &&
  typeof value === 'object' &&
  !isRef(value) &&
  Array.isArray((value as OpenAPIV3.SchemaObject).allOf) &&
  ((value as OpenAPIV3.SchemaObject).allOf?.length ?? 0) > 1

/**
 * The reference graph the parser's copying follows: a node per component
 * schema and per inline multi-member `allOf`; an edge to a component for
 * every `$ref` in a node's subtree, and an edge to an inline `allOf` for
 * every one nested in it (that nested node owns its own subtree).
 */
const toRefGraph = (document: OpenAPIV3.Document): RefGraph => {
  const nodes = new Map<string, Node>()
  const inline = new Map<object, Node>()

  const walk = (value: unknown, frames: string[], owner: Node): void => {
    if (value === null || typeof value !== 'object') {
      return
    }

    if (isRef(value)) {
      owner.edges.add(componentId(toRefName(value.$ref)))
      return
    }

    if (isInlineAllOf(value) && value !== ownerValue.get(owner)) {
      const id = frames.join('/')
      const node: Node = { id, frames, edges: new Set() }
      nodes.set(id, node)
      inline.set(value, node)
      ownerValue.set(node, value)
      owner.edges.add(id)
      walk(value, frames, node)
      return
    }

    const entries = Array.isArray(value)
      ? value.map((item, index): [string, unknown] => [`${index}`, item])
      : Object.entries(value)

    for (const [key, child] of entries) {
      walk(child, [...frames, key], owner)
    }
  }

  const ownerValue = new WeakMap<Node, object>()

  for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
    const frames = ['components', 'schemas', name]
    const node: Node = { id: componentId(name), frames, edges: new Set() }
    nodes.set(node.id, node)
    if (schema !== null && typeof schema === 'object') {
      ownerValue.set(node, schema)
    }
    walk(schema, frames, node)
  }

  const root: Node = { id: '#', frames: [], edges: new Set() }
  nodes.set(root.id, root)

  const { components: _components, ...rest } = document
  walk(rest, [], root)

  for (const [key, value] of Object.entries(document.components ?? {})) {
    if (key !== 'schemas') {
      walk(value, ['components', key], root)
    }
  }

  return { nodes, inline }
}

/** Can `start` reach itself again by following edges? */
const onCycle = (start: string, graph: RefGraph): boolean => {
  const seen = new Set<string>()
  const stack = [...(graph.nodes.get(start)?.edges ?? [])]

  while (stack.length > 0) {
    const id = stack.pop()

    if (id === undefined) {
      break
    }

    if (id === start) {
      return true
    }

    if (seen.has(id)) {
      continue
    }

    seen.add(id)
    stack.push(...(graph.nodes.get(id)?.edges ?? []))
  }

  return false
}

const at = (document: object, frames: string[]): Record<string, unknown> | undefined => {
  let current: unknown = document

  for (const frame of frames) {
    if (current === null || typeof current !== 'object') {
      return undefined
    }

    current = (current as Record<string, unknown>)[frame]
  }

  return current !== null && typeof current === 'object'
    ? (current as Record<string, unknown>)
    : undefined
}
