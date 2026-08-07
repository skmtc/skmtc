import { assertEquals, assertThrows } from '@std/assert'
import { inferProtocol, ProtocolInferenceError } from './inferProtocol.ts'

Deno.test('inferProtocol - reads OAS from the version key', () => {
  assertEquals(inferProtocol('{"openapi": "3.0.0", "paths": {}}'), 'oas')
  assertEquals(inferProtocol('openapi: 3.0.0\npaths: {}\n'), 'oas')
  assertEquals(inferProtocol('swagger: "2.0"\npaths: {}\n'), 'oas')
})

Deno.test('inferProtocol - reads SDL from a definition', () => {
  assertEquals(inferProtocol('type Query { a: Int }'), 'gql')
  assertEquals(inferProtocol('schema {\n  query: Query\n}'), 'gql')
  assertEquals(inferProtocol('scalar DateTime'), 'gql')
})

Deno.test('inferProtocol - reads SDL with the brace on the next line', () => {
  // Both parse as valid SDL under graphql@16. A same-line-only test
  // rejects them, and the CLI has no flag to force a protocol, so a miss
  // here leaves the document with no way in.
  assertEquals(inferProtocol('type Query\n{\n  a: Int\n}'), 'gql')
  assertEquals(inferProtocol('extend schema\n  @link(url: "https://specs.example/v2")'), 'gql')
})

Deno.test('inferProtocol - prose that opens like a definition is not SDL', () => {
  // The reason the test is positive rather than a fallthrough: a YAML
  // block scalar carries ordinary text, and a wrapped line can begin
  // `type of widget` or end `see schema`.
  assertEquals(inferProtocol('openapi: 3.0.0\ndesc: |\n  type of widget\n  is round\n'), 'oas')
  assertThrows(() => inferProtocol('the type of widget\nis round\n'), ProtocolInferenceError)
  assertThrows(
    () => inferProtocol('notes: |\n  see schema\n  defined above\n'),
    ProtocolInferenceError
  )
})

Deno.test('inferProtocol - markup wins over SDL-looking text inside it', () => {
  // An HTML page can carry a `<pre>` block whose line begins `type Query
  // {`. The SDL test would claim it and hand markup to the GraphQL
  // parser, which is what the markup branch exists to prevent — so the
  // markup check has to run first.
  const error = assertThrows(
    () => inferProtocol('<!doctype html>\n<pre>\ntype Query {\n</pre>'),
    ProtocolInferenceError
  )

  assertEquals(error.message.includes('HTML or XML page'), true)
})

Deno.test('inferProtocol - an HTML page says it is an HTML page', () => {
  // The most common non-schema answer, and the reason this is worth a
  // sentence of its own: a source behind SSO serves a login page, either
  // where it redirected to or in place at the URL that was asked for.
  // Detection used to live in the CLI and read `Content-Type`, which
  // frameworks routinely set wrong; the body cannot be wrong.
  for (const page of [
    '<!doctype html><title>Sign in</title>',
    '\n  <html><body>Forbidden</body></html>',
    '<?xml version="1.0"?><error/>'
  ]) {
    const error = assertThrows(() => inferProtocol(page), ProtocolInferenceError)

    assertEquals(error.message.includes('HTML or XML page'), true, page)
    assertEquals(error.message.includes('SSO'), true, page)
  }
})

Deno.test('inferProtocol - a spec is read from its body whatever it was served as', () => {
  // Express's `res.send(string)` and Flask's bare-string return both
  // answer `text/html` for a hand-rolled `/openapi.json`. Nothing here
  // consults a header, so such a source simply works.
  assertEquals(inferProtocol('{"openapi": "3.0.0"}'), 'oas')
})

Deno.test('inferProtocol - rejects a document that is neither', () => {
  const error = assertThrows(() => inferProtocol('{"name": "not-a-spec"}'), ProtocolInferenceError)

  assertEquals(error.message.includes('neither an OpenAPI document'), true)
})

Deno.test('inferProtocol - rejects an empty document', () => {
  assertThrows(() => inferProtocol('   \n'), ProtocolInferenceError, 'empty')
})

Deno.test('inferProtocol - a broken OAS document reports the parse failure', () => {
  // Announces itself as OAS on line 1, then fails to parse. Routing it to
  // the GraphQL parser would report the wrong language.
  const error = assertThrows(
    () => inferProtocol('openapi: 3.0.0\n  type Query {\n bad: [\n'),
    ProtocolInferenceError
  )

  assertEquals(error.message.includes('Could not read the document'), true)
})
