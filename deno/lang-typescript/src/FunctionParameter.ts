// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import { isIdentifierName } from 'npm:@babel/helper-validator-identifier@7.27.1'
import { camelCase } from '@skmtc/core'
import type { TypeSystemObject, TypeSystemValue, TypeSystemVoid } from '@skmtc/core'
import type { DefinitionBase } from '@skmtc/core'
import { List, type SkipEmptyOption } from './List.ts'
import type { Stringable } from '@skmtc/core'
import { isEmpty } from '@skmtc/core'

/**
 * Constructor arguments for {@link FunctionParameter}.
 */
type FunctionParameterArgs = {
  /** Optional parameter name (if undefined and destructure is true, uses destructured syntax) */
  name?: string
  /** The type definition for the parameter */
  typeDefinition: DefinitionBase<TypeSystemObject | TypeSystemVoid>
  /** Whether to use destructured parameter syntax */
  destructure?: boolean
  /** Whether the parameter is required (affects optional marker) */
  required?: boolean
  /** Whether to skip empty properties in destructured parameters */
  skipEmpty?: boolean
}

/**
 * Union type representing the different parameter configurations.
 */
export type ParameterProperties = VoidParameter | DestructuredParameter | RegularParameter

/**
 * Represents a void parameter (no parameters).
 */
export type VoidParameter = {
  type: 'void'
}

/**
 * Represents a destructured object parameter.
 */
export type DestructuredParameter = {
  type: 'destructured'
  typeDefinition: DefinitionBase<TypeSystemObject>
  required: true
}

/**
 * Represents a regular named parameter.
 */
export type RegularParameter = {
  type: 'regular'
  name: string
  typeDefinition: DefinitionBase<TypeSystemValue>
  required: boolean
}

/**
 * Generates TypeScript function parameters with advanced handling for different parameter patterns.
 *
 * `FunctionParameter` is a sophisticated utility for generating TypeScript function parameter
 * syntax that handles multiple parameter patterns including named parameters, destructured
 * object parameters, and void parameters. It provides intelligent type handling and can
 * generate both the parameter declaration and the parameter usage patterns.
 *
 * This class is essential for generating type-safe function signatures in API clients,
 * utility functions, and other generated code where parameters need to be handled
 * consistently and safely.
 *
 * ## Supported Parameter Patterns
 *
 * - **Named Parameters**: Traditional `paramName: Type` syntax
 * - **Destructured Parameters**: `{ prop1, prop2 }: ObjectType` syntax
 * - **Void Parameters**: No parameters when dealing with void types
 * - **Optional Parameters**: Automatic handling of optional parameter markers
 * - **Empty Filtering**: Option to skip empty properties in destructured objects
 *
 * @example Named parameter generation
 * ```typescript
 * import { FunctionParameter, createVariable } from '@skmtc/lang-typescript';
 *
 * const userIdParam = new FunctionParameter({
 *   name: 'userId',
 *   typeDefinition: new Definition({
 *     context: generateContext,
 *     identifier: createType('string'),
 *     value: { type: 'string' }
 *   }),
 *   required: true
 * });
 *
 * console.log(userIdParam.toString()); // 'userId: string'
 * console.log(userIdParam.toInbound()); // 'userId'
 * ```
 *
 * @example Destructured parameter generation
 * ```typescript
 * const destructuredParam = new FunctionParameter({
 *   typeDefinition: new Definition({
 *     context: generateContext,
 *     identifier: createType('UserParams'),
 *     value: {
 *       type: 'object',
 *       objectProperties: {
 *         properties: {
 *           name: { type: 'string' },
 *           email: { type: 'string' },
 *           age: { type: 'number' }
 *         }
 *       }
 *     }
 *   }),
 *   destructure: true,
 *   required: true
 * });
 *
 * console.log(destructuredParam.toString());
 * // '{ name, email, age }: UserParams'
 *
 * console.log(destructuredParam.toInbound());
 * // '{ name, email, age }'
 * ```
 *
 * @example Optional parameter handling
 * ```typescript
 * const optionalParam = new FunctionParameter({
 *   name: 'options',
 *   typeDefinition: optionsTypeDefinition,
 *   required: false
 * });
 *
 * console.log(optionalParam.toString()); // 'options?: OptionsType'
 * ```
 *
 * @example Void parameter handling
 * ```typescript
 * const voidParam = new FunctionParameter({
 *   typeDefinition: new Definition({
 *     context: generateContext,
 *     identifier: createType('void'),
 *     value: { type: 'void' }
 *   })
 * });
 *
 * console.log(voidParam.toString()); // ''
 * console.log(voidParam.toInbound()); // ''
 * ```
 *
 * @example Property checking
 * ```typescript
 * const objectParam = new FunctionParameter({
 *   typeDefinition: userTypeDefinition,
 *   destructure: true,
 *   required: true
 * });
 *
 * if (objectParam.hasProperty('email')) {
 *   // Handle email property access
 *   console.log('Parameter includes email property');
 * }
 *
 * const propertyList = objectParam.toPropertyList();
 * console.log(propertyList.toString()); // 'name, email, age'
 * ```
 *
 * @example API method generation with parameters
 * ```typescript
 * class ApiMethodGenerator {
 *   generateMethod(
 *     methodName: string,
 *     pathParams?: FunctionParameter,
 *     bodyParam?: FunctionParameter
 *   ) {
 *     const parameters = [pathParams, bodyParam]
 *       .filter(p => p && p.toString())
 *       .map(p => p!.toString())
 *       .join(', ');
 *
 *     const pathInbound = pathParams?.toInbound() || '';
 *     const bodyInbound = bodyParam?.toInbound() || '';
 *
 *     return `
 * async ${methodName}(${parameters}) {
 *   const path = this.buildPath(${pathInbound});
 *   return this.request('POST', path, ${bodyInbound});
 * }`;
 *   }
 * }
 * ```
 *
 * @example Empty property filtering
 * ```typescript
 * const filteredParam = new FunctionParameter({
 *   typeDefinition: sparseObjectDefinition,
 *   destructure: true,
 *   required: true,
 *   skipEmpty: true // Skip properties with empty types
 * });
 *
 * // Only non-empty properties will be included in destructuring
 * console.log(filteredParam.toString());
 * // '{ validProp1, validProp2 }: FilteredType' (empty props omitted)
 * ```
 */
export class FunctionParameter {
  /** The internal parameter configuration determining how the parameter is generated */
  properties: ParameterProperties

  /** Whether to skip empty properties in destructured parameters */
  skipEmpty?: boolean

  /**
   * Creates a new FunctionParameter instance with the specified configuration.
   *
   * The constructor analyzes the provided type definition and configuration options
   * to determine the appropriate parameter pattern (void, regular, or destructured).
   * It handles the complex logic of parameter type determination and validation.
   *
   * @param args - Configuration options for the function parameter
   *
   * @throws {Error} When the parameter configuration is invalid
   *
   * @example
   * ```typescript
   * const param = new FunctionParameter({
   *   name: 'userData',
   *   typeDefinition: userTypeDefinition,
   *   required: true
   * });
   * ```
   */
  constructor(args: FunctionParameterArgs) {
    this.skipEmpty = args.skipEmpty

    if (args.typeDefinition.value.type === 'object') {
      if (args.destructure === true && args.required === true) {
        this.properties = {
          type: 'destructured' as const,
          typeDefinition: args.typeDefinition as DefinitionBase<TypeSystemObject>,
          required: args.required
        };
      } else if (typeof args.name === 'string') {
        this.properties = {
          type: 'regular' as const,
          name: args.name,
          typeDefinition: args.typeDefinition as DefinitionBase<TypeSystemObject>,
          required: args.required ?? false
        };
      } else {
        throw new Error('Invalid FunctionParameter');
      }
    } else {
      this.properties = { type: 'void' }
    }
  }

  /**
   * Checks if the parameter has a specific property (for object-based parameters).
   *
   * This method determines whether a given property name exists within the parameter's
   * type structure. It's useful for conditional code generation based on available
   * properties and only returns true for object-based parameters (regular object
   * parameters or destructured parameters).
   *
   * @param name - The property name to check for
   * @returns True if the property exists in the parameter's type structure
   *
   * @example
   * ```typescript
   * const userParam = new FunctionParameter({
   *   typeDefinition: userTypeDefinition, // has properties: name, email, age
   *   destructure: true,
   *   required: true
   * });
   *
   * if (userParam.hasProperty('email')) {
   *   console.log('Parameter includes email property');
   * }
   *
   * if (userParam.hasProperty('nonexistent')) {
   *   // This won't execute
   * }
   * ```
   */
  hasProperty(name: string): boolean {
    switch (this.properties.type) {
      case 'void':
        return false;

      case 'regular': {
        const { typeDefinition } = this.properties;
        const { value } = typeDefinition;
        return Boolean(value.type === 'object' && value.objectProperties?.properties[name]);
      }

      case 'destructured': {
        const { typeDefinition } = this.properties;
        return Boolean(typeDefinition.value.objectProperties?.properties[name]);
      }

      default: {
        const _exhaustive: never = this.properties;
        throw new Error(`Unhandled properties type: ${(_exhaustive as any).type}`);
      }
    }
  }

  /**
   * Generates a List of property names from the parameter.
   *
   * This method extracts property names from object-based parameters and returns
   * them as a List instance. For regular parameters, it returns the parameter name,
   * for destructured parameters it returns all object properties, and for void
   * parameters it returns an empty list.
   *
   * @returns List containing the relevant property or parameter names
   *
   * @example
   * ```typescript
   * const destructuredParam = new FunctionParameter({
   *   typeDefinition: userTypeDefinition, // has properties: name, email, age
   *   destructure: true,
   *   required: true
   * });
   *
   * const propertyList = destructuredParam.toPropertyList();
   * console.log(propertyList.toString()); // 'name, email, age'
   *
   * const regularParam = new FunctionParameter({
   *   name: 'userData',
   *   typeDefinition: userTypeDefinition,
   *   required: true
   * });
   *
   * const regularList = regularParam.toPropertyList();
   * console.log(regularList.toString()); // 'userData'
   * ```
   */
  toPropertyList(): List {
    switch (this.properties.type) {
      case 'void':
        return List.toEmpty();

      case 'regular': {
        const { name } = this.properties;
        return List.toSingle(name);
      }

      case 'destructured': {
        const { typeDefinition } = this.properties;
        return List.fromKeys(typeDefinition.value.objectProperties?.properties).toObjectPlain();
      }

      default: {
        const _exhaustive: never = this.properties;
        throw new Error(`Unhandled properties type: ${(_exhaustive as any).type}`);
      }
    }
  }

  /**
   * Generates the inbound parameter syntax for function calls.
   *
   * This method produces the syntax used when calling a function with this parameter.
   * For regular parameters, it returns the parameter name. For destructured parameters,
   * it returns the destructured object syntax. For void parameters, it returns an
   * empty string.
   *
   * @returns The inbound parameter syntax string
   *
   * @example
   * ```typescript
   * const regularParam = new FunctionParameter({
   *   name: 'userId',
   *   typeDefinition: stringTypeDefinition,
   *   required: true
   * });
   *
   * console.log(regularParam.toInbound()); // 'userId'
   *
   * const destructuredParam = new FunctionParameter({
   *   typeDefinition: userTypeDefinition,
   *   destructure: true,
   *   required: true
   * });
   *
   * console.log(destructuredParam.toInbound()); // '{ name, email, age }'
   * ```
   */
  toInbound(): string {
    switch (this.properties.type) {
      case 'void':
        return '';

      case 'regular': {
        const { name } = this.properties;
        return `${name}`;
      }

      case 'destructured': {
        const { typeDefinition } = this.properties;
        return toDestructured(typeDefinition, { skipEmpty: this.skipEmpty }).toString();
      }

      default: {
        const _exhaustive: never = this.properties;
        throw new Error(`Unhandled properties type: ${(_exhaustive as any).type}`);
      }
    }
  }

  /**
   * Generates the complete function parameter declaration syntax.
   *
   * This method produces the full parameter declaration that appears in a function
   * signature, including the parameter name, type annotation, and optional markers.
   * It handles all parameter patterns supported by the class.
   *
   * @returns The complete parameter declaration string
   *
   * @example
   * ```typescript
   * const requiredParam = new FunctionParameter({
   *   name: 'userId',
   *   typeDefinition: stringTypeDefinition,
   *   required: true
   * });
   *
   * console.log(requiredParam.toString()); // 'userId: string'
   *
   * const optionalParam = new FunctionParameter({
   *   name: 'options',
   *   typeDefinition: optionsTypeDefinition,
   *   required: false
   * });
   *
   * console.log(optionalParam.toString()); // 'options?: OptionsType'
   *
   * const destructuredParam = new FunctionParameter({
   *   typeDefinition: userTypeDefinition,
   *   destructure: true,
   *   required: true
   * });
   *
   * console.log(destructuredParam.toString()); // '{ name, email, age }: UserType'
   * ```
   */
  toString(): string {
    switch (this.properties.type) {
      case 'void':
        return '';

      case 'regular': {
        const { name, typeDefinition, required } = this.properties;
        return `${name}${required ? '' : '?'}: ${typeDefinition.identifier}`;
      }

      case 'destructured': {
        const { typeDefinition } = this.properties;
        if (this.skipEmpty) {
          if (isEmpty(typeDefinition.value.objectProperties?.properties ?? {})) {
            return '';
          }
        }

        return List.toKeyValue(
          toDestructured(typeDefinition, { skipEmpty: this.skipEmpty }).toString(),
          typeDefinition.identifier
        ).toString();
      }

      default: {
        const _exhaustive: never = this.properties;
        throw new Error(`Unhandled properties type: ${(_exhaustive as any).type}`);
      }
    }
  }
}

/**
 * Generates destructured object parameter syntax from a type definition.
 *
 * This helper function creates the destructured parameter syntax for object types,
 * handling property name validation and optional camelCase conversion for invalid
 * JavaScript identifiers. It integrates with the List system to produce properly
 * formatted destructured parameter lists.
 *
 * @param typeDefinition - The object type definition to destructure
 * @param options - Options for controlling the destructuring behavior
 * @param options.skipEmpty - Whether to skip empty properties
 * @returns List instance representing the destructured parameter structure
 *
 * @example
 * ```typescript
 * const objectDef = new Definition({
 *   context: generateContext,
 *   identifier: createType('ApiParams'),
 *   value: {
 *     type: 'object',
 *     objectProperties: {
 *       properties: {
 *         'user-id': { type: 'string' },
 *         'valid_name': { type: 'string' },
 *         'api-key': { type: 'string' }
 *       }
 *     }
 *   }
 * });
 *
 * const result = toDestructured(objectDef);
 * console.log(result.toString());
 * // "{ 'user-id': userId, valid_name, 'api-key': apiKey }"
 * ```
 */
const toDestructured = (
  typeDefinition: DefinitionBase<TypeSystemObject>,
  { skipEmpty }: SkipEmptyOption = {}
): List<Stringable[], ', ', '{}'> => {
  return List.fromKeys(typeDefinition.value.objectProperties?.properties).toObject(
    key => {
      return isIdentifierName(key) ? key : List.toKeyValue(key, camelCase(key))
    },
    {
      skipEmpty
    }
  )
}
