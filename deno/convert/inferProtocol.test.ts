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
