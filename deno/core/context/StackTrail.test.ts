import { assertEquals, assertThrows } from '@std/assert'
import { StackTrail } from './StackTrail.ts'

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

// slice() Method Tests
Deno.test('StackTrail - slice with start and end indices', () => {
  const trail = new StackTrail(['a', 'b', 'c', 'd', 'e'])
  const sliced = trail.slice(1, 3)

  assertEquals(sliced.stackTrail, ['b', 'c'])
  assertEquals(sliced.toString(), 'b:c')
})

Deno.test('StackTrail - slice with only start index', () => {
  const trail = new StackTrail(['a', 'b', 'c', 'd', 'e'])
  const sliced = trail.slice(2)

  assertEquals(sliced.stackTrail, ['c', 'd', 'e'])
  assertEquals(sliced.toString(), 'c:d:e')
})

Deno.test('StackTrail - slice does not modify original', () => {
  const trail = new StackTrail(['a', 'b', 'c'])
  trail.slice(1)

  assertEquals(trail.stackTrail, ['a', 'b', 'c'])
})

Deno.test('StackTrail - slice with out of bounds indices returns empty', () => {
  const trail = new StackTrail(['a', 'b'])
  const sliced = trail.slice(5, 10)

  assertEquals(sliced.stackTrail, [])
  assertEquals(sliced.toString(), '')
})

// includes() Method Tests
Deno.test('StackTrail - includes returns true for single existing frame', () => {
  const trail = new StackTrail(['components', 'schemas', 'User', 'properties'])

  assertEquals(trail.includes(['schemas']), true)
})

Deno.test('StackTrail - includes returns true for multiple existing frames', () => {
  const trail = new StackTrail(['components', 'schemas', 'User', 'properties'])

  assertEquals(trail.includes(['schemas', 'User']), true)
  assertEquals(trail.includes(['components', 'properties']), true)
})

Deno.test('StackTrail - includes returns false for non-existent frame', () => {
  const trail = new StackTrail(['components', 'schemas', 'User', 'properties'])

  assertEquals(trail.includes(['Product']), false)
  assertEquals(trail.includes(['schemas', 'Product']), false)
})

Deno.test('StackTrail - includes returns true for empty array', () => {
  const trail = new StackTrail(['components', 'schemas'])

  assertEquals(trail.includes([]), true)
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

  assertThrows(
    () => trail.append(123 as any),
    Error,
    'Unexpected stack frame: 123'
  )
})

// getParentOf() Method Tests
Deno.test('StackTrail - getParentOf returns parent name for property', () => {
  const trail = new StackTrail(['components', 'schemas', 'User', 'properties', 'email'])
  const parent = trail.getParentOf('email')

  assertEquals(parent, 'User')
})

Deno.test('StackTrail - getParentOf returns undefined for non-property frame', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])
  const parent = trail.getParentOf('User')

  assertEquals(parent, undefined)
})

Deno.test('StackTrail - getParentOf returns undefined when frame not at end', () => {
  const trail = new StackTrail(['components', 'schemas', 'User', 'properties', 'email', 'type'])
  const parent = trail.getParentOf('email')

  assertEquals(parent, undefined)
})

Deno.test('StackTrail - getParentOf returns undefined for nested property without parent', () => {
  const trail = new StackTrail(['properties', 'email'])
  const parent = trail.getParentOf('email')

  assertEquals(parent, undefined)
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

  assertThrows(
    () => trail.remove(123 as any),
    Error,
    'Unexpected stack frame: 123'
  )
})

// Static join() Method Tests
Deno.test('StackTrail - join multiple StackTrail instances', () => {
  const trail1 = new StackTrail(['components', 'schemas'])
  const trail2 = new StackTrail(['User', 'properties'])

  const joined = StackTrail.join(trail1, trail2)

  assertEquals(joined, 'components:schemas:User:properties')
})

Deno.test('StackTrail - join StackTrail instances and strings', () => {
  const trail1 = new StackTrail(['components', 'schemas'])
  const trail2 = new StackTrail(['User', 'properties'])

  const joined = StackTrail.join(trail1, 'separator', trail2)

  assertEquals(joined, 'components:schemas:separator:User:properties')
})

Deno.test('StackTrail - join single StackTrail', () => {
  const trail = new StackTrail(['components', 'schemas'])
  const joined = StackTrail.join(trail)

  assertEquals(joined, 'components:schemas')
})

Deno.test('StackTrail - join only strings', () => {
  const joined = StackTrail.join('a', 'b', 'c')

  assertEquals(joined, 'a:b:c')
})

Deno.test('StackTrail - join empty trails', () => {
  const trail1 = new StackTrail()
  const trail2 = new StackTrail()

  const joined = StackTrail.join(trail1, trail2)

  assertEquals(joined, ':')
})

// Static parse() Method Tests
Deno.test('StackTrail - parse colon-separated string', () => {
  const trail = StackTrail.parse('components:schemas:User:properties:name')

  assertEquals(trail.stackTrail, ['components', 'schemas', 'User', 'properties', 'name'])
  assertEquals(trail.toString(), 'components:schemas:User:properties:name')
})

Deno.test('StackTrail - parse handles escaped colons', () => {
  const trail = StackTrail.parse('components:schemas:User%3AType')

  assertEquals(trail.stackTrail, ['components', 'schemas', 'User:Type'])
})

Deno.test('StackTrail - parse single token', () => {
  const trail = StackTrail.parse('components')

  assertEquals(trail.stackTrail, ['components'])
  assertEquals(trail.toString(), 'components')
})

Deno.test('StackTrail - parse throws error for empty token', () => {
  assertThrows(
    () => StackTrail.parse('components::schemas'),
    Error,
    'Empty stack trail token in: components::schemas'
  )
})

Deno.test('StackTrail - parse throws error for leading colon', () => {
  assertThrows(
    () => StackTrail.parse(':components:schemas'),
    Error,
    'Empty stack trail token in: :components:schemas'
  )
})

Deno.test('StackTrail - parse throws error for trailing colon', () => {
  assertThrows(
    () => StackTrail.parse('components:schemas:'),
    Error,
    'Empty stack trail token in: components:schemas:'
  )
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

// Integration Tests
Deno.test('StackTrail - round-trip parse and toString', () => {
  const original = 'components:schemas:User:properties:name'
  const trail = StackTrail.parse(original)
  const result = trail.toString()

  assertEquals(result, original)
})

Deno.test('StackTrail - round-trip with escaped colons', () => {
  const trail = new StackTrail(['components', 'schemas', 'User:Admin'])
  const str = trail.toString()
  const parsed = StackTrail.parse(str)

  assertEquals(parsed.stackTrail, trail.stackTrail)
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

Deno.test('StackTrail - building and traversing schema path', () => {
  const trail = new StackTrail()

  trail.append('components')
    .append('schemas')
    .append('User')
    .append('properties')
    .append('email')

  assertEquals(trail.toString(), 'components:schemas:User:properties:email')
  assertEquals(trail.getParentOf('email'), 'User')

  trail.remove(['properties', 'email'])

  assertEquals(trail.toString(), 'components:schemas:User')
  assertEquals(trail.toStackRef(), '#/components/schemas/User')
})
