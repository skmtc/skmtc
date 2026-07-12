import { assertEquals, assertThrows } from '@std/assert'
import { StackTrail } from '@/context/StackTrail.ts'

// Constructor Tests
Deno.test('StackTrail - constructor with empty array creates empty stack', () => {
  const trail = new StackTrail()
  assertEquals(trail.stackTrail, [])
  assertEquals(trail.toString(), '')
})

Deno.test('StackTrail - constructor with pre-populated array', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])
  assertEquals(trail.stackTrail, ['components', 'schemas', 'User'])
  assertEquals(trail.toString(), 'components:schemas:User')
})

// clone() Method Tests
Deno.test('StackTrail - clone creates independent copy', () => {
  const original = new StackTrail(['components', 'schemas'])
  const cloned = original.clone()

  assertEquals(cloned.stackTrail, original.stackTrail)
  assertEquals(cloned.toString(), original.toString())
})

Deno.test('StackTrail - clone mutations do not affect original', () => {
  const original = new StackTrail(['components', 'schemas'])
  const cloned = original.clone()

  cloned.append('User')

  assertEquals(original.toString(), 'components:schemas')
  assertEquals(cloned.toString(), 'components:schemas:User')
})

// stackTrail Getter Tests
Deno.test('StackTrail - stackTrail getter returns correct array', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])
  const frames = trail.stackTrail

  assertEquals(frames, ['components', 'schemas', 'User'])
})

// append() Method Tests
Deno.test('StackTrail - append single string', () => {
  const trail = new StackTrail(['components'])
  trail.append('schemas')

  assertEquals(trail.stackTrail, ['components', 'schemas'])
  assertEquals(trail.toString(), 'components:schemas')
})

Deno.test('StackTrail - append array of strings', () => {
  const trail = new StackTrail()
  trail.append(['components', 'schemas', 'User'])

  assertEquals(trail.stackTrail, ['components', 'schemas', 'User'])
  assertEquals(trail.toString(), 'components:schemas:User')
})

Deno.test('StackTrail - append returns this for chaining', () => {
  const trail = new StackTrail()
  const result = trail.append('components').append('schemas').append('User')

  assertEquals(result, trail)
  assertEquals(trail.toString(), 'components:schemas:User')
})

Deno.test('StackTrail - append throws error for invalid input', () => {
  const trail = new StackTrail()

  assertThrows(() => trail.append(123 as any), Error, 'Unexpected stack frame: 123')
})

// toStackRef() Method Tests
Deno.test('StackTrail - toStackRef returns valid reference for schemas', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])
  const ref = trail.toStackRef()

  assertEquals(ref, '#/components/schemas/User')
})

Deno.test('StackTrail - toStackRef returns valid reference for responses', () => {
  const trail = new StackTrail(['components', 'responses', 'NotFound'])
  const ref = trail.toStackRef()

  assertEquals(ref, '#/components/responses/NotFound')
})

Deno.test('StackTrail - toStackRef returns valid reference for parameters', () => {
  const trail = new StackTrail(['components', 'parameters', 'PageSize'])
  const ref = trail.toStackRef()

  assertEquals(ref, '#/components/parameters/PageSize')
})

Deno.test('StackTrail - toStackRef returns valid reference for examples', () => {
  const trail = new StackTrail(['components', 'examples', 'UserExample'])
  const ref = trail.toStackRef()

  assertEquals(ref, '#/components/examples/UserExample')
})

Deno.test('StackTrail - toStackRef returns valid reference for requestBodies', () => {
  const trail = new StackTrail(['components', 'requestBodies', 'UserRequest'])
  const ref = trail.toStackRef()

  assertEquals(ref, '#/components/requestBodies/UserRequest')
})

Deno.test('StackTrail - toStackRef returns valid reference for headers', () => {
  const trail = new StackTrail(['components', 'headers', 'Authorization'])
  const ref = trail.toStackRef()

  assertEquals(ref, '#/components/headers/Authorization')
})

Deno.test('StackTrail - toStackRef returns valid reference for securitySchemes', () => {
  const trail = new StackTrail(['components', 'securitySchemes', 'BearerAuth'])
  const ref = trail.toStackRef()

  assertEquals(ref, '#/components/securitySchemes/BearerAuth')
})

Deno.test('StackTrail - toStackRef returns undefined for non-component trail', () => {
  const trail = new StackTrail(['paths', '/users', 'get'])
  const ref = trail.toStackRef()

  assertEquals(ref, undefined)
})

Deno.test('StackTrail - toStackRef returns undefined for invalid component key', () => {
  const trail = new StackTrail(['components', 'invalid', 'Something'])
  const ref = trail.toStackRef()

  assertEquals(ref, undefined)
})

Deno.test('StackTrail - toStackRef returns undefined for incomplete trail', () => {
  const trail = new StackTrail(['components', 'schemas'])
  const ref = trail.toStackRef()

  assertEquals(ref, undefined)
})

Deno.test('StackTrail - toStackRef returns undefined for empty trail', () => {
  const trail = new StackTrail()
  const ref = trail.toStackRef()

  assertEquals(ref, undefined)
})

// remove() Method Tests
Deno.test('StackTrail - remove single frame', () => {
  const trail = new StackTrail(['components', 'schemas', 'User', 'properties'])
  trail.remove('properties')

  assertEquals(trail.stackTrail, ['components', 'schemas', 'User'])
  assertEquals(trail.toString(), 'components:schemas:User')
})

Deno.test('StackTrail - remove array of frames', () => {
  const trail = new StackTrail(['components', 'schemas', 'User', 'properties', 'name'])
  trail.remove(['properties', 'name'])

  assertEquals(trail.stackTrail, ['components', 'schemas', 'User'])
  assertEquals(trail.toString(), 'components:schemas:User')
})

Deno.test('StackTrail - remove returns this for chaining', () => {
  const trail = new StackTrail(['a', 'b', 'c'])
  const result = trail.remove('c').remove('b')

  assertEquals(result, trail)
  assertEquals(trail.toString(), 'a')
})

Deno.test('StackTrail - remove throws error for mismatched frame', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])

  assertThrows(
    () => trail.remove('schemas'),
    Error,
    "Expected to remove frame 'schemas' but found 'User'"
  )
})

Deno.test('StackTrail - remove throws error for invalid input', () => {
  const trail = new StackTrail(['components'])

  assertThrows(() => trail.remove(123 as any), Error, 'Unexpected stack frame: 123')
})

// toString() Method Tests
Deno.test('StackTrail - toString returns colon-separated string', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])

  assertEquals(trail.toString(), 'components:schemas:User')
})

Deno.test('StackTrail - toString escapes colons in frame names', () => {
  const trail = new StackTrail(['components', 'schemas', 'User:Type'])

  assertEquals(trail.toString(), 'components:schemas:User%3AType')
})

Deno.test('StackTrail - toString returns empty string for empty stack', () => {
  const trail = new StackTrail()

  assertEquals(trail.toString(), '')
})

Deno.test('StackTrail - toString with single frame', () => {
  const trail = new StackTrail(['components'])

  assertEquals(trail.toString(), 'components')
})

Deno.test('StackTrail - toString handles multiple colons in frame name', () => {
  const trail = new StackTrail(['a:b:c'])

  assertEquals(trail.toString(), 'a%3Ab%3Ac')
})

// toJSON() Method Tests
Deno.test('StackTrail - toJSON returns string representation', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])

  assertEquals(trail.toJSON(), 'components:schemas:User')
})

Deno.test('StackTrail - toJSON matches toString', () => {
  const trail = new StackTrail(['components', 'schemas', 'User:Type'])

  assertEquals(trail.toJSON(), trail.toString())
})

Deno.test('StackTrail - toJSON serializes correctly in JSON.stringify', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])
  const json = JSON.stringify({ path: trail })

  assertEquals(json, '{"path":"components:schemas:User"}')
})

Deno.test('StackTrail - toJSON handles empty stack', () => {
  const trail = new StackTrail()

  assertEquals(trail.toJSON(), '')
})

Deno.test('StackTrail - complex workflow example', () => {
  const baseTrail = new StackTrail(['components', 'schemas'])

  const userTrail = baseTrail.clone().append('User')
  const productTrail = baseTrail.clone().append('Product')

  assertEquals(userTrail.toString(), 'components:schemas:User')
  assertEquals(productTrail.toString(), 'components:schemas:Product')
  assertEquals(baseTrail.toString(), 'components:schemas')

  assertEquals(userTrail.toStackRef(), '#/components/schemas/User')
  assertEquals(productTrail.toStackRef(), '#/components/schemas/Product')
})

Deno.test('StackTrail - toJsonPointer for components root', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])
  assertEquals(trail.toJsonPointer(), '#/components/schemas/User')
})

Deno.test('StackTrail - toJsonPointer escapes path segments per RFC 6901', () => {
  const trail = new StackTrail(['paths', '/users/{id}', 'get'])
  assertEquals(trail.toJsonPointer(), '#/paths/~1users~1{id}/get')
})

Deno.test('StackTrail - toJsonPointer for empty stack returns root', () => {
  const trail = new StackTrail()
  assertEquals(trail.toJsonPointer(), '#/')
})

Deno.test('StackTrail - toJsonPointer escapes tildes', () => {
  const trail = new StackTrail(['components', 'schemas', 'Has~Tilde'])
  assertEquals(trail.toJsonPointer(), '#/components/schemas/Has~0Tilde')
})

Deno.test('StackTrail - toJsonPointer covers non-components paths', () => {
  // toStackRef returns undefined for non-components paths; toJsonPointer
  // produces a valid pointer for any visitor path.
  const trail = new StackTrail(['paths', '/users', 'get', 'responses', '200'])
  assertEquals(trail.toStackRef(), undefined)
  assertEquals(trail.toJsonPointer(), '#/paths/~1users/get/responses/200')
})

Deno.test('StackTrail - toSchemaPointer strips the run operational prefix', () => {
  // Production-shaped trail: worker seeds [traceId, spanId], parse phase
  // adds 'parse', then the document traversal is appended.
  const trail = new StackTrail([
    'trace-1780233682442',
    'span-1780233682442',
    'parse',
    'components',
    'schemas',
    'Pet',
    'properties',
    'name'
  ])
  assertEquals(trail.toSchemaPointer(), '#/components/schemas/Pet/properties/name')
  // toJsonPointer keeps the raw (non-resolvable) trail.
  assertEquals(
    trail.toJsonPointer(),
    '#/trace-1780233682442/span-1780233682442/parse/components/schemas/Pet/properties/name'
  )
})

Deno.test('StackTrail - toSchemaPointer leaves an already document-relative trail unchanged', () => {
  // Test/empty-seeded trails have no phase frame and are already
  // document-relative; toSchemaPointer is then identical to toJsonPointer.
  const trail = new StackTrail(['components', 'schemas', 'User'])
  assertEquals(trail.toSchemaPointer(), '#/components/schemas/User')
})

Deno.test('StackTrail - toSchemaPointer for an operation path strips the prefix', () => {
  const trail = new StackTrail(['trace-1', 'span-1', 'parse', 'paths', '/users/{id}', 'get'])
  assertEquals(trail.toSchemaPointer(), '#/paths/~1users~1{id}/get')
})

Deno.test('StackTrail - toSchemaPointer for empty trail returns document root', () => {
  assertEquals(new StackTrail().toSchemaPointer(), '#/')
})

Deno.test('StackTrail - toSchemaPointer matches the first phase frame, not a same-named document key', () => {
  // A schema literally named 'parse' sits after the operational phase
  // frame; only the operational one (earliest) is the boundary.
  const trail = new StackTrail(['trace-1', 'span-1', 'parse', 'components', 'schemas', 'parse'])
  assertEquals(trail.toSchemaPointer(), '#/components/schemas/parse')
})
