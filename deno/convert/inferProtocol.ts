import { stringToSchema } from './toV3Document.ts'

/**
 * Reading a schema document's protocol from the document itself.
 *
 * The alternative is deriving it from where the document came from — a
 * file extension, a URL, a `Content-Type` header. That answer is only as
 * good as the naming: an endpoint with no extension carries no answer at
 * all, a server that mislabels its own response gives a wrong one, and a
 * redirect can leave both stale. The document says what it is, so it is
 * the only source that cannot disagree with itself.
 *
 * Shared so the CLI and the stack server reach the same verdict for the
 * same bytes.
 */

/** The document could not be read as either supported language. */
export class ProtocolInferenceError extends Error {
  override readonly name = 'ProtocolInferenceError'
}

export type Protocol = 'oas' | 'gql'

/** A GraphQL Name, as the spec defines it. */
const NAME = '[_A-Za-z][_0-9A-Za-z]*'

/**
 * Does this text carry a GraphQL SDL definition? Each alternative is a
 * definition keyword, its name, and the token that must follow — `{`, `@`,
 * `implements`, `=`. Keyword-plus-whitespace alone is not enough: YAML block
 * scalars carry ordinary prose, and a wrapped line reading `type of widget
 * is ...` or `schema defined in components.` opens with exactly that shape.
 *
 * This is a POSITIVE test, deliberately: gql is not the fallthrough for
 * "everything that isn't OpenAPI". An HTML error page and a JSON document
 * with no `openapi` key are neither protocol, and saying so beats handing
 * them to the GraphQL parser and reporting its syntax error.
 */
const SDL_DEFINITION = new RegExp(
  [
    // `type Foo {`, `type Foo implements Bar`, `type Foo @dir`
    `(?:type|interface|input)[ \\t]+${NAME}[ \\t]*(?:\\{|@|implements[ \\t])`,
    // `enum Foo {`, `enum Foo @dir`
    `enum[ \\t]+${NAME}[ \\t]*(?:\\{|@)`,
    // `union Foo = A | B`
    `union[ \\t]+${NAME}[ \\t]*(?:=|@)`,
    // `scalar Foo` — nothing but a directive may follow on the line
    `scalar[ \\t]+${NAME}[ \\t]*(?:@|$)`,
    // `schema {`, `schema @dir {`
    `schema[ \\t]*(?:\\{|@)`,
    // `directive @foo on FIELD_DEFINITION`
    `directive[ \\t]*@`
  ]
    .map(definition => `^[ \\t]*(?:extend[ \\t]+)?(?:${definition})`)
    .join('|'),
  'm'
)

export const looksLikeSdl = (schema: string): boolean => SDL_DEFINITION.test(schema)

/**
 * Does this text announce itself as an OpenAPI document? Anchored at column
 * 0, where an OAS document carries its version key. Indented, the same text
 * is a nested mapping key or an SDL field named `openapi` — neither of which
 * is the header.
 */
const announcesOas = (schema: string): boolean => /^(?:openapi|swagger)[ \t]*:/m.test(schema)

type ParseOutcome =
  /** Read as a JSON/YAML mapping — the shape an OAS document has. */
  | { kind: 'document'; document: object }
  /** Read, but not as a mapping: a plain scalar (an HTML page reads as one),
   *  a list, `null`. */
  | { kind: 'scalar' }
  | { kind: 'unreadable'; reason: string }

const toParseOutcome = (schema: string): ParseOutcome => {
  try {
    const parsed = stringToSchema(schema)

    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { kind: 'document', document: parsed }
      : { kind: 'scalar' }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    return { kind: 'unreadable', reason }
  }
}

/**
 * Infer the protocol from document content: a JSON/YAML mapping carrying an
 * `openapi` or `swagger` key is OAS; a document carrying an SDL definition is
 * GraphQL. Anything else raises `ProtocolInferenceError` rather than being
 * routed to a parser that will only be able to say the text is not its
 * language — an HTML error page from a `source` behind an SSO wall, a JSON
 * document with no `openapi` key, a truncated document, an empty response.
 *
 * The two tests are independent, so neither ordering nor the parse succeeding
 * decides the answer alone: single-line SDL (`type Query { a: Int }`) reads as
 * a YAML mapping, and SDL with a field named `openapi` fails the YAML parse.
 */
export const inferProtocol = (schema: string): Protocol => {
  if (schema.trim() === '') {
    throw new ProtocolInferenceError('The schema document is empty.')
  }

  const outcome = toParseOutcome(schema)

  if (
    outcome.kind === 'document' &&
    ('openapi' in outcome.document || 'swagger' in outcome.document)
  ) {
    return 'oas'
  }

  // A document that announces itself as OAS on line 1 and then fails to parse
  // is a broken OAS document, not SDL. Reporting the YAML failure names the
  // problem; running it through the GraphQL parser reports the wrong language.
  const brokenOas = outcome.kind === 'unreadable' && announcesOas(schema)

  if (!brokenOas && looksLikeSdl(schema)) {
    return 'gql'
  }

  // Markup gets its own sentence. It is the single most common non-schema
  // answer — a source behind SSO or an authenticating proxy serves a login
  // page, either where it redirected to or in place at the URL that was
  // asked for — and "neither OpenAPI nor SDL" describes it without
  // explaining it.
  if (isMarkup(schema)) {
    throw new ProtocolInferenceError(
      'The document is an HTML or XML page rather than a schema. A source ' +
        'behind SSO or an authenticating proxy typically answers this way ' +
        'with a login page. Bundle the schema to a local file, or point at ' +
        'a local proxy that injects the credential.'
    )
  }

  throw new ProtocolInferenceError(
    outcome.kind === 'unreadable'
      ? `Could not read the document as JSON or YAML: ${outcome.reason}. ` +
          'Pass an OpenAPI document or GraphQL SDL.'
      : 'The document is neither an OpenAPI document (no `openapi` or ' +
          '`swagger` key) nor GraphQL SDL.'
  )
}

/** A document opening with `<` is markup: never JSON, YAML or SDL. */
const isMarkup = (schema: string): boolean => schema.trimStart().startsWith('<')
