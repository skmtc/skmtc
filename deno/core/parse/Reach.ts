import { fromModelKey, toModelKey, type RefParts } from '@/helpers/refFns.ts'
import { toRefKey } from '@/parse/toRefKey.ts'
import { canNameSchema } from '@/parse/toCyclicRefs.ts'
import type { OasRefData } from '@/oas/ref/ref-types.ts'

/** A ref the parser read, and where it is. */
export type ReadRef = {
  /** The ref, with the kind of object the parser read it as: only a `schema` ref can name a model. */
  ref: RefParts & { refType: OasRefData['refType'] }
  /** The frames of the ref's place in the document: `['paths', '/pets', 'get', …]`. */
  place: readonly string[]
  /** The key of the ref target the parser read it for; `undefined` in the document's own walk. */
  refTarget: string | undefined
}

/** Where an operation is in a document. An `OasOperation` fits it. */
type OperationPlace = { path: string; method: string }

/** Where a webhook is in a document. An `OasWebhook` fits it. */
type WebhookPlace = { name: string; method: string }

/** What the refs in one place name. */
type Named = {
  /** The keys of the models. */
  models: Set<string>
  /**
   * The keys (`toRefKey`) of the objects that are no schemas: a parameter, a
   * response, a request body, a header, as a component or a pointer into the document.
   */
  components: Set<string>
}

/**
 * What a subject of a document can reach through `$ref`s: the models a
 * generator can get to from it, each by its model key (`toModelKey`).
 *
 * It is read from the refs the parser itself read, each with its place
 * (`ParseContext.toReach`). So it has what a generator can follow in the
 * parsed document, and no more: a `$ref` the parser took for data is not in
 * it, and neither is the parent of an `allOf` that the parser merged into
 * its child. It needs no walk of the document of its own.
 *
 * A place is a model, an operation, the parameters of a path item, or a
 * component that is no schema. The models a place names are those its own
 * refs give, and those behind each such component it refers to. A model
 * reaches the models it names, and the models those name.
 */
export class Reach {
  #named = new Map<string, Named>()
  /** By a model's key: the keys of the models it reaches, its own first, read one time. */
  #reached = new Map<string, readonly string[]>()
  /** By a model's key: the keys of the models it names, read one time. */
  #namedByModel = new Map<string, readonly string[]>()

  constructor(refs: Iterable<ReadRef>) {
    for (const { ref, place, refTarget } of refs) {
      const named = this.#toNamed(refTarget ?? toPlaceKey(place))

      // A pointer into `paths` passes `canNameSchema` whatever it points at,
      // so a parameter or a response ref is told apart by its `refType`.
      if (ref.refType === 'schema' && canNameSchema(ref)) {
        named.models.add(toModelKey(ref))
      } else {
        named.components.add(toRefKey(ref))
      }
    }
  }

  /** The keys of the models a model reaches, its own included. */
  ofModel(ref: RefParts): readonly string[] {
    const key = toModelKey(ref)
    const found = this.#reached.get(key)

    if (found !== undefined) {
      return found
    }

    const seen = new Set<string>([key])
    const reached = [key]

    // `reached` grows while it is walked: each model may name more models.
    for (const next of reached) {
      this.#toNamedByModel(next).forEach(model => {
        if (!seen.has(model)) {
          seen.add(model)
          reached.push(model)
        }
      })
    }

    this.#reached.set(key, reached)

    return reached
  }

  /**
   * The keys of the models an operation names: `paths[path][method]`, with
   * what every operation of the path has, which is the path item's
   * `parameters`, and any ref kept at the path item itself. The parser does
   * not read a path item's own `$ref` yet, so that last place is empty.
   */
  namedByOperation({ path, method }: OperationPlace): readonly string[] {
    return this.#namedAt([
      toPlaceKey(['paths', path, method]),
      toPlaceKey(['paths', path, 'parameters']),
      toPlaceKey(['paths', path])
    ])
  }

  /** The keys of the models a webhook names: `webhooks[name][method]`, as {@link namedByOperation}. */
  namedByWebhook({ name, method }: WebhookPlace): readonly string[] {
    return this.#namedAt([
      toPlaceKey(['webhooks', name, method]),
      toPlaceKey(['webhooks', name, 'parameters']),
      toPlaceKey(['webhooks', name])
    ])
  }

  /** The models a model names. Many models reach one model, so each is read one time. */
  #toNamedByModel(key: string): readonly string[] {
    const found = this.#namedByModel.get(key)

    if (found !== undefined) {
      return found
    }

    const named = this.#namedAt([toRefKey(fromModelKey(key))])

    this.#namedByModel.set(key, named)

    return named
  }

  /** The models the places name, also behind each component that is no schema, through any chain of them. */
  #namedAt(places: string[]): readonly string[] {
    const seen = new Set<string>(places)
    const models = new Set<string>()

    // `places` grows while it is walked: each component may refer to more components.
    for (const place of places) {
      const named = this.#named.get(place)

      named?.models.forEach(model => models.add(model))
      named?.components.forEach(component => {
        if (!seen.has(component)) {
          seen.add(component)
          places.push(component)
        }
      })
    }

    return [...models]
  }

  #toNamed(place: string): Named {
    const found = this.#named.get(place)

    if (found !== undefined) {
      return found
    }

    const named = { models: new Set<string>(), components: new Set<string>() }

    this.#named.set(place, named)

    return named
  }
}

/**
 * The key of the place a ref is in. A component is keyed as a ref to it is
 * (`toRefKey`), so a ref leads to the refs inside its target. An operation
 * is keyed by its first three frames, and a ref at a path item itself by two.
 */
const toPlaceKey = (place: readonly string[]): string =>
  place[0] === 'components' ? `#/components/${place[1]}/${place[2]}` : place.slice(0, 3).join('\n')
