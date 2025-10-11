import { assertEquals } from '@std/assert/equals'
import { sanitizePropertyName } from './sanitizePropertyName.ts'

// Protected Keywords Tests
// Note: These keywords are in the protectedKeywords map and get converted to {keyword}Value
Deno.test('sanitizePropertyName converts "return" protected keyword to "returnValue"', () => {
  const sanitized = sanitizePropertyName('return')
  assertEquals(sanitized, 'returnValue')
})

Deno.test('sanitizePropertyName converts "default" protected keyword to "defaultValue"', () => {
  const sanitized = sanitizePropertyName('default')
  assertEquals(sanitized, 'defaultValue')
})

Deno.test('sanitizePropertyName converts "if" protected keyword to "ifValue"', () => {
  const sanitized = sanitizePropertyName('if')
  assertEquals(sanitized, 'ifValue')
})

Deno.test('sanitizePropertyName converts "function" protected keyword to "functionValue"', () => {
  const sanitized = sanitizePropertyName('function')
  assertEquals(sanitized, 'functionValue')
})

Deno.test('sanitizePropertyName converts "var" protected keyword to "varValue"', () => {
  const sanitized = sanitizePropertyName('var')
  assertEquals(sanitized, 'varValue')
})

Deno.test('sanitizePropertyName converts "null" protected keyword to "nullValue"', () => {
  const sanitized = sanitizePropertyName('null')
  assertEquals(sanitized, 'nullValue')
})

Deno.test('sanitizePropertyName converts "true" protected keyword to "trueValue"', () => {
  const sanitized = sanitizePropertyName('true')
  assertEquals(sanitized, 'trueValue')
})

Deno.test('sanitizePropertyName converts "false" protected keyword to "falseValue"', () => {
  const sanitized = sanitizePropertyName('false')
  assertEquals(sanitized, 'falseValue')
})

// Protected keywords with asterisk patterns
Deno.test('sanitizePropertyName converts "enum *" protected keyword to "enumStarValue"', () => {
  const sanitized = sanitizePropertyName('enum *')
  assertEquals(sanitized, 'enumStarValue')
})

Deno.test('sanitizePropertyName converts "class *" protected keyword to "classStarValue"', () => {
  const sanitized = sanitizePropertyName('class *')
  assertEquals(sanitized, 'classStarValue')
})

Deno.test('sanitizePropertyName converts "const *" protected keyword to "constStarValue"', () => {
  const sanitized = sanitizePropertyName('const *')
  assertEquals(sanitized, 'constStarValue')
})

// Invalid Identifiers Tests - Spaces
Deno.test('sanitizePropertyName converts "with space" to key-value format', () => {
  const sanitized = sanitizePropertyName('with space')
  assertEquals(sanitized.toString(), "'with space': withSpace")
})

Deno.test('sanitizePropertyName converts "multiple   spaces" to key-value format', () => {
  const sanitized = sanitizePropertyName('multiple   spaces')
  assertEquals(sanitized.toString(), "'multiple   spaces': multipleSpaces")
})

Deno.test('sanitizePropertyName converts "leading and trailing spaces" to key-value format', () => {
  const sanitized = sanitizePropertyName(' leading trailing ')
  assertEquals(sanitized.toString(), "' leading trailing ': leadingTrailing")
})

// Invalid Identifiers Tests - Dots
Deno.test('sanitizePropertyName converts "with.dot" to key-value format', () => {
  const sanitized = sanitizePropertyName('with.dot')
  assertEquals(sanitized.toString(), "'with.dot': withDot")
})

Deno.test('sanitizePropertyName converts "nested.property.name" to key-value format', () => {
  const sanitized = sanitizePropertyName('nested.property.name')
  assertEquals(sanitized.toString(), "'nested.property.name': nestedPropertyName")
})

// Invalid Identifiers Tests - Dashes
Deno.test('sanitizePropertyName converts "kebab-case-name" to key-value format', () => {
  const sanitized = sanitizePropertyName('kebab-case-name')
  assertEquals(sanitized.toString(), "'kebab-case-name': kebabCaseName")
})

Deno.test('sanitizePropertyName converts "with-dash" to key-value format', () => {
  const sanitized = sanitizePropertyName('with-dash')
  assertEquals(sanitized.toString(), "'with-dash': withDash")
})

// Invalid Identifiers Tests - Slashes
Deno.test('sanitizePropertyName converts "with/slash" to key-value format', () => {
  const sanitized = sanitizePropertyName('with/slash')
  assertEquals(sanitized.toString(), "'with/slash': withSlash")
})

Deno.test('sanitizePropertyName converts "path/to/resource" to key-value format', () => {
  const sanitized = sanitizePropertyName('path/to/resource')
  assertEquals(sanitized.toString(), "'path/to/resource': pathToResource")
})

// Invalid Identifiers Tests - Special Characters
Deno.test('sanitizePropertyName converts "with@symbol" to key-value format', () => {
  const sanitized = sanitizePropertyName('with@symbol')
  assertEquals(sanitized.toString(), "'with@symbol': withSymbol")
})

Deno.test('sanitizePropertyName converts "with#hash" to key-value format', () => {
  const sanitized = sanitizePropertyName('with#hash')
  assertEquals(sanitized.toString(), "'with#hash': withHash")
})

Deno.test('sanitizePropertyName converts "with!bang" to key-value format', () => {
  const sanitized = sanitizePropertyName('with!bang')
  assertEquals(sanitized.toString(), "'with!bang': withBang")
})

Deno.test('sanitizePropertyName converts "with%percent" to key-value format', () => {
  const sanitized = sanitizePropertyName('with%percent')
  assertEquals(sanitized.toString(), "'with%percent': withPercent")
})

Deno.test('sanitizePropertyName converts "with&ampersand" to key-value format', () => {
  const sanitized = sanitizePropertyName('with&ampersand')
  assertEquals(sanitized.toString(), "'with&ampersand': withAmpersand")
})

// Invalid Identifiers Tests - Starts with Number
Deno.test('sanitizePropertyName converts "123numeric" to key-value format', () => {
  const sanitized = sanitizePropertyName('123numeric')
  assertEquals(sanitized.toString(), "'123numeric': 123numeric")
})

Deno.test('sanitizePropertyName converts "1stPlace" to key-value format', () => {
  const sanitized = sanitizePropertyName('1stPlace')
  assertEquals(sanitized.toString(), "'1stPlace': 1stPlace")
})

// Invalid Identifiers Tests - Mixed Special Characters
Deno.test('sanitizePropertyName converts "get-user/by-id@v2" to key-value format', () => {
  const sanitized = sanitizePropertyName('get-user/by-id@v2')
  assertEquals(sanitized.toString(), "'get-user/by-id@v2': getUserByIdV2")
})

Deno.test('sanitizePropertyName converts "api.v2.users-list" to key-value format', () => {
  const sanitized = sanitizePropertyName('api.v2.users-list')
  assertEquals(sanitized.toString(), "'api.v2.users-list': apiV2UsersList")
})

// Invalid Identifiers Tests - Unicode/International Characters
// Note: Unicode letters like 'é' are valid in JavaScript identifiers
Deno.test('sanitizePropertyName returns "café" as-is (valid identifier with Unicode)', () => {
  const sanitized = sanitizePropertyName('café')
  assertEquals(sanitized, 'café')
})

Deno.test('sanitizePropertyName converts "hello👋" to key-value format', () => {
  const sanitized = sanitizePropertyName('hello👋')
  assertEquals(sanitized.toString(), "'hello👋': hello")
})

// Valid Identifiers Tests - CamelCase
Deno.test('sanitizePropertyName returns "validName" as-is', () => {
  const sanitized = sanitizePropertyName('validName')
  assertEquals(sanitized, 'validName')
})

Deno.test('sanitizePropertyName returns "userId" as-is', () => {
  const sanitized = sanitizePropertyName('userId')
  assertEquals(sanitized, 'userId')
})

Deno.test('sanitizePropertyName returns "camelCase" as-is', () => {
  const sanitized = sanitizePropertyName('camelCase')
  assertEquals(sanitized, 'camelCase')
})

// Valid Identifiers Tests - PascalCase
Deno.test('sanitizePropertyName returns "PascalCase" as-is', () => {
  const sanitized = sanitizePropertyName('PascalCase')
  assertEquals(sanitized, 'PascalCase')
})

Deno.test('sanitizePropertyName returns "UserProfile" as-is', () => {
  const sanitized = sanitizePropertyName('UserProfile')
  assertEquals(sanitized, 'UserProfile')
})

// Valid Identifiers Tests - With Underscores
Deno.test('sanitizePropertyName returns "_private" as-is', () => {
  const sanitized = sanitizePropertyName('_private')
  assertEquals(sanitized, '_private')
})

Deno.test('sanitizePropertyName returns "__proto__" as-is', () => {
  const sanitized = sanitizePropertyName('__proto__')
  assertEquals(sanitized, '__proto__')
})

Deno.test('sanitizePropertyName returns "user_id" as-is', () => {
  const sanitized = sanitizePropertyName('user_id')
  assertEquals(sanitized, 'user_id')
})

Deno.test('sanitizePropertyName returns "_" as-is', () => {
  const sanitized = sanitizePropertyName('_')
  assertEquals(sanitized, '_')
})

// Valid Identifiers Tests - With Dollar Sign
Deno.test('sanitizePropertyName returns "$jquery" as-is', () => {
  const sanitized = sanitizePropertyName('$jquery')
  assertEquals(sanitized, '$jquery')
})

Deno.test('sanitizePropertyName returns "$value" as-is', () => {
  const sanitized = sanitizePropertyName('$value')
  assertEquals(sanitized, '$value')
})

Deno.test('sanitizePropertyName returns "$" as-is', () => {
  const sanitized = sanitizePropertyName('$')
  assertEquals(sanitized, '$')
})

// Valid Identifiers Tests - With Numbers (not starting)
Deno.test('sanitizePropertyName returns "name123" as-is', () => {
  const sanitized = sanitizePropertyName('name123')
  assertEquals(sanitized, 'name123')
})

Deno.test('sanitizePropertyName returns "test1" as-is', () => {
  const sanitized = sanitizePropertyName('test1')
  assertEquals(sanitized, 'test1')
})

// Valid Identifiers Tests - Single Character
Deno.test('sanitizePropertyName returns "a" as-is', () => {
  const sanitized = sanitizePropertyName('a')
  assertEquals(sanitized, 'a')
})

Deno.test('sanitizePropertyName returns "x" as-is', () => {
  const sanitized = sanitizePropertyName('x')
  assertEquals(sanitized, 'x')
})

// Valid Identifiers Tests - All Caps
Deno.test('sanitizePropertyName returns "API" as-is', () => {
  const sanitized = sanitizePropertyName('API')
  assertEquals(sanitized, 'API')
})

Deno.test('sanitizePropertyName returns "HTTP" as-is', () => {
  const sanitized = sanitizePropertyName('HTTP')
  assertEquals(sanitized, 'HTTP')
})

// Edge Cases Tests
// Deno.test('sanitizePropertyName handles empty string', () => {
//   const sanitized = sanitizePropertyName('')
//   assertEquals(sanitized.toString(), ': ')
// })

// Deno.test('sanitizePropertyName handles numbers only "123"', () => {
//   const sanitized = sanitizePropertyName('123')
//   assertEquals(sanitized.toString(), '123: 123')
// })

// Deno.test('sanitizePropertyName handles special chars only "!!!"', () => {
//   const sanitized = sanitizePropertyName('!!!')
//   assertEquals(sanitized.toString(), '!!!: ')
// })

// Deno.test('sanitizePropertyName handles single space " "', () => {
//   const sanitized = sanitizePropertyName(' ')
//   assertEquals(sanitized.toString(), ' : ')
// })

// Deno.test('sanitizePropertyName handles parentheses "(value)"', () => {
//   const sanitized = sanitizePropertyName('(value)')
//   assertEquals(sanitized.toString(), '(value): value')
// })

// Deno.test('sanitizePropertyName handles brackets "[value]"', () => {
//   const sanitized = sanitizePropertyName('[value]')
//   assertEquals(sanitized.toString(), '[value]: value')
// })

// Deno.test('sanitizePropertyName handles braces "{value}"', () => {
//   const sanitized = sanitizePropertyName('{value}')
//   assertEquals(sanitized.toString(), '{value}: value')
// })

// Deno.test('sanitizePropertyName handles question mark "optional?"', () => {
//   const sanitized = sanitizePropertyName('optional?')
//   assertEquals(sanitized.toString(), 'optional?: optional')
// })

// Deno.test('sanitizePropertyName handles asterisk pattern "status *"', () => {
//   const sanitized = sanitizePropertyName('status *')
//   // The asterisk is removed by camelCase, not converted to "Star"
//   assertEquals(sanitized.toString(), 'status *: status')
// })

// Deno.test('sanitizePropertyName handles plus sign "counter+"', () => {
//   const sanitized = sanitizePropertyName('counter+')
//   assertEquals(sanitized.toString(), 'counter+: counter')
// })
