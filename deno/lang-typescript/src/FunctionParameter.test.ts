import { assertEquals, assertThrows } from '@std/assert'
import { createType } from './createIdentifier.ts'
import { FunctionParameter } from './FunctionParameter.ts'
import { handleKey } from '@/src/identifiers.ts'
import { toParameterVariable } from '@/src/toParameterVariable.ts'
import type {
  DefinitionBase,
  TypeSystemObject,
  TypeSystemVoid,
  TypeSystemString
} from '@skmtc/core'

// Mock helper to create a simple Definition-like object. FunctionParameter
// only consumes the neutral `DefinitionBase` surface (`.value`), so the mock
// ducks that shape; bridging a plain object onto the abstract class needs the
// `unknown` hop (a test-only structural mock, not an identifier cast).
const createMockDefinition = (
  value: TypeSystemObject | TypeSystemVoid,
  identifierName = 'MockType'
): DefinitionBase<TypeSystemObject | TypeSystemVoid> => {
  return {
    identifier: createType(identifierName),
    value,
    toString: () => identifierName
  } as unknown as DefinitionBase<TypeSystemObject | TypeSystemVoid>
}

// Helper to create a mock string type for testing
const mockStringType = (): TypeSystemString => ({
  type: 'string',
  format: undefined,
  enums: undefined,
  modifiers: { required: true, nullable: false }
})

// Helper to create a mock number type for testing
const mockNumberType = () => ({
  type: 'number' as const,
  modifiers: { required: true, nullable: false }
})

// Test: Constructor with void type
Deno.test('FunctionParameter - constructor creates void parameter', () => {
  const voidDef = createMockDefinition({ type: 'void' })
  const param = new FunctionParameter({
    typeDefinition: voidDef
  })

  assertEquals(param.properties.type, 'void')
})

// Test: Constructor with regular named parameter
Deno.test('FunctionParameter - constructor creates regular parameter with name', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    name: 'userData',
    typeDefinition: objectDef,
    required: true
  })

  assertEquals(param.properties.type, 'regular')
  if (param.properties.type === 'regular') {
    assertEquals(param.properties.name, 'userData')
    assertEquals(param.properties.required, true)
  }
})

// Test: Constructor with destructured parameter
Deno.test('FunctionParameter - constructor creates destructured parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType(),
        email: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true
  })

  assertEquals(param.properties.type, 'destructured')
  if (param.properties.type === 'destructured') {
    assertEquals(param.properties.required, true)
  }
})

// Test: Constructor with optional regular parameter
Deno.test('FunctionParameter - constructor creates optional regular parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        value: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    name: 'options',
    typeDefinition: objectDef,
    required: false
  })

  assertEquals(param.properties.type, 'regular')
  if (param.properties.type === 'regular') {
    assertEquals(param.properties.name, 'options')
    assertEquals(param.properties.required, false)
  }
})

// Test: Constructor throws error for invalid configuration
Deno.test('FunctionParameter - constructor throws error for object without name and not destructured', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  assertThrows(
    () => {
      new FunctionParameter({
        typeDefinition: objectDef,
        // No name and destructure is not true
        destructure: false,
        required: true
      })
    },
    Error,
    'Invalid FunctionParameter'
  )
})

// Test: Constructor throws error for destructured but not required
Deno.test('FunctionParameter - constructor throws error for destructured without required', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  assertThrows(
    () => {
      new FunctionParameter({
        typeDefinition: objectDef,
        destructure: true,
        required: false
      })
    },
    Error,
    'Invalid FunctionParameter'
  )
})

// Test: hasProperty returns false for void parameter
Deno.test('FunctionParameter - hasProperty returns false for void parameter', () => {
  const voidDef = createMockDefinition({ type: 'void' })
  const param = new FunctionParameter({
    typeDefinition: voidDef
  })

  assertEquals(param.hasProperty('anyProperty'), false)
})

// Test: hasProperty returns true for existing property in regular parameter
Deno.test('FunctionParameter - hasProperty returns true for existing property in regular parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType(),
        email: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    name: 'userData',
    typeDefinition: objectDef,
    required: true
  })

  assertEquals(param.hasProperty('name'), true)
  assertEquals(param.hasProperty('email'), true)
})

// Test: hasProperty returns false for non-existing property in regular parameter
Deno.test('FunctionParameter - hasProperty returns false for non-existing property in regular parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    name: 'userData',
    typeDefinition: objectDef,
    required: true
  })

  assertEquals(param.hasProperty('nonExistent'), false)
})

// Test: hasProperty returns true for existing property in destructured parameter
Deno.test('FunctionParameter - hasProperty returns true for existing property in destructured parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType(),
        age: mockNumberType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true
  })

  assertEquals(param.hasProperty('name'), true)
  assertEquals(param.hasProperty('age'), true)
})

// Test: hasProperty returns false for non-existing property in destructured parameter
Deno.test('FunctionParameter - hasProperty returns false for non-existing property in destructured parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true
  })

  assertEquals(param.hasProperty('nonExistent'), false)
})

// Test: toPropertyList returns empty list for void parameter
Deno.test('FunctionParameter - toPropertyList returns empty for void parameter', () => {
  const voidDef = createMockDefinition({ type: 'void' })
  const param = new FunctionParameter({
    typeDefinition: voidDef
  })

  const result = param.toPropertyList()
  assertEquals(result.toString(), '')
})

// Test: toPropertyList returns parameter name for regular parameter
Deno.test('FunctionParameter - toPropertyList returns name for regular parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        value: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    name: 'userData',
    typeDefinition: objectDef,
    required: true
  })

  const result = param.toPropertyList()
  assertEquals(result.toString(), 'userData')
})

// Test: toPropertyList returns property names for destructured parameter
Deno.test('FunctionParameter - toPropertyList returns properties for destructured parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType(),
        email: mockStringType(),
        age: mockNumberType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true
  })

  const result = param.toPropertyList()
  assertEquals(result.toString(), '{name, email, age}')
})

// Test: toInbound returns empty string for void parameter
Deno.test('FunctionParameter - toInbound returns empty for void parameter', () => {
  const voidDef = createMockDefinition({ type: 'void' })
  const param = new FunctionParameter({
    typeDefinition: voidDef
  })

  assertEquals(param.toInbound(), '')
})

// Test: toInbound returns parameter name for regular parameter
Deno.test('FunctionParameter - toInbound returns name for regular parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        value: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    name: 'userId',
    typeDefinition: objectDef,
    required: true
  })

  assertEquals(param.toInbound(), 'userId')
})

// Test: toInbound returns destructured syntax for destructured parameter
Deno.test('FunctionParameter - toInbound returns destructured syntax for destructured parameter', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        name: mockStringType(),
        email: mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true
  })

  assertEquals(param.toInbound(), '{name, email}')
})

// Test: toString returns empty string for void parameter
Deno.test('FunctionParameter - toString returns empty for void parameter', () => {
  const voidDef = createMockDefinition({ type: 'void' })
  const param = new FunctionParameter({
    typeDefinition: voidDef
  })

  assertEquals(param.toString(), '')
})

// Test: toString returns correct syntax for required regular parameter
Deno.test('FunctionParameter - toString returns correct syntax for required regular parameter', () => {
  const objectDef = createMockDefinition(
    {
      type: 'object',
      recordProperties: null,
      objectProperties: {
        properties: {
          value: mockStringType()
        }
      },
      modifiers: { required: true, nullable: false }
    },
    'UserType'
  )

  const param = new FunctionParameter({
    name: 'userData',
    typeDefinition: objectDef,
    required: true
  })

  assertEquals(param.toString(), 'userData: UserType')
})

// Test: toString returns correct syntax for optional regular parameter
Deno.test('FunctionParameter - toString returns correct syntax for optional regular parameter', () => {
  const objectDef = createMockDefinition(
    {
      type: 'object',
      recordProperties: null,
      objectProperties: {
        properties: {
          value: mockStringType()
        }
      },
      modifiers: { required: true, nullable: false }
    },
    'OptionsType'
  )

  const param = new FunctionParameter({
    name: 'options',
    typeDefinition: objectDef,
    required: false
  })

  assertEquals(param.toString(), 'options?: OptionsType')
})

// Test: toString returns correct syntax for destructured parameter
Deno.test('FunctionParameter - toString returns correct syntax for destructured parameter', () => {
  const objectDef = createMockDefinition(
    {
      type: 'object',
      recordProperties: null,
      objectProperties: {
        properties: {
          name: mockStringType(),
          email: mockStringType()
        }
      },
      modifiers: { required: true, nullable: false }
    },
    'UserParams'
  )

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true
  })

  assertEquals(param.toString(), '{name, email}: UserParams')
})

// Test: skipEmpty option works with destructured parameters
Deno.test('FunctionParameter - skipEmpty option returns empty for empty object properties', () => {
  const objectDef = createMockDefinition(
    {
      type: 'object',
      recordProperties: null,
      objectProperties: {
        properties: {}
      },
      modifiers: { required: true, nullable: false }
    },
    'EmptyType'
  )

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true,
    skipEmpty: true
  })

  assertEquals(param.toString(), '')
})

// Test: skipEmpty option does not affect non-empty object properties
Deno.test('FunctionParameter - skipEmpty option works correctly for non-empty properties', () => {
  const objectDef = createMockDefinition(
    {
      type: 'object',
      recordProperties: null,
      objectProperties: {
        properties: {
          name: mockStringType()
        }
      },
      modifiers: { required: true, nullable: false }
    },
    'NonEmptyType'
  )

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true,
    skipEmpty: true
  })

  assertEquals(param.toString(), '{name}: NonEmptyType')
})

// Test: toInbound with skipEmpty option for empty properties
Deno.test('FunctionParameter - toInbound with skipEmpty for empty properties', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {}
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true,
    skipEmpty: true
  })

  // Empty object with skipEmpty should return empty object syntax
  assertEquals(param.toInbound(), '')
})

// Test: hasProperty with object having no objectProperties
Deno.test('FunctionParameter - hasProperty returns false when objectProperties is null', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: null,
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    name: 'emptyObject',
    typeDefinition: objectDef,
    required: true
  })

  assertEquals(param.hasProperty('anything'), false)
})

// Test: Default required value when not specified
Deno.test('FunctionParameter - defaults required to false when not specified for regular parameter', () => {
  const objectDef = createMockDefinition(
    {
      type: 'object',
      recordProperties: null,
      objectProperties: {
        properties: {
          value: mockStringType()
        }
      },
      modifiers: { required: true, nullable: false }
    },
    'SomeType'
  )

  const param = new FunctionParameter({
    name: 'param',
    typeDefinition: objectDef
    // required not specified
  })

  assertEquals(param.toString(), 'param?: SomeType')
})

// Test: Handles invalid identifiers (special characters that need camelCase conversion)
Deno.test('FunctionParameter - toInbound handles invalid identifiers in destructured params', () => {
  const objectDef = createMockDefinition({
    type: 'object',
    recordProperties: null,
    objectProperties: {
      properties: {
        'user-id': mockStringType(),
        'api-key': mockStringType()
      }
    },
    modifiers: { required: true, nullable: false }
  })

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true
  })

  assertEquals(param.toInbound(), "{'user-id': userId, 'api-key': apiKey}")
})

// Test: toString with invalid identifiers in destructured params
Deno.test('FunctionParameter - toString handles invalid identifiers in destructured params', () => {
  const objectDef = createMockDefinition(
    {
      type: 'object',
      recordProperties: null,
      objectProperties: {
        properties: {
          'user-id': mockStringType()
        }
      },
      modifiers: { required: true, nullable: false }
    },
    'ParamsType'
  )

  const param = new FunctionParameter({
    typeDefinition: objectDef,
    destructure: true,
    required: true
  })

  assertEquals(param.toString(), "{'user-id': userId}: ParamsType")
})

const toDestructuredParameter = (keys: string[]): FunctionParameter => {
  return new FunctionParameter({
    typeDefinition: createMockDefinition(
      {
        type: 'object',
        recordProperties: null,
        objectProperties: {
          properties: Object.fromEntries(keys.map(key => [key, mockStringType()]))
        },
        modifiers: { required: true, nullable: false }
      },
      'Args'
    ),
    destructure: true,
    required: true
  })
}

Deno.test('FunctionParameter - an ordinary name destructures without a rename', () => {
  const param = toDestructuredParameter(['id', 'user_id', '$top', 'toString'])

  assertEquals(param.toString(), '{id, user_id, $top, toString}: Args')
  assertEquals(param.toPropertyList().toString(), '{id, user_id, $top, toString}')
})

Deno.test('FunctionParameter - a reserved name destructures under its own name', () => {
  const param = toDestructuredParameter(['export', 'class', 'await', 'arguments'])

  assertEquals(
    param.toInbound(),
    '{export: exportValue, class: classValue, await: awaitValue, arguments: argumentsValue}'
  )
})

Deno.test('FunctionParameter - toPropertyList gives the variables', () => {
  const param = toDestructuredParameter(["'enterprise-team'", 'actor.ip', 'export', '2fa'])

  assertEquals(param.toPropertyList().values, ['enterpriseTeam', 'actorIp', 'exportValue', '_2fa'])
})

Deno.test('FunctionParameter - a key that is a string literal is not quoted again', () => {
  const param = toDestructuredParameter(["'user-id'", "'it\\'s'", '"api-key"'])

  assertEquals(param.toInbound(), `{'user-id': userId, 'it\\'s': itS, "api-key": apiKey}`)
})

Deno.test('FunctionParameter - a rendered key gives the variable of its name', () => {
  const names = ['a\nb', 'a b', 'a\\nb', "it's"]
  const variables = toDestructuredParameter(names.map(handleKey)).toPropertyList().values

  assertEquals(variables, names.map(toParameterVariable))
  assertEquals(variables, ['aB', 'aB', 'aNb', 'itS'])
})

Deno.test('FunctionParameter - quotes at both ends do not make a key a string literal', () => {
  assertEquals(toDestructuredParameter(["'a'b'"]).toInbound(), "{'\\'a\\'b\\'': aB}")
})
