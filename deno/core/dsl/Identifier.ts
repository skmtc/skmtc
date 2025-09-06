import { EntityType } from './EntityType.ts'

/**
 * Constructor arguments for {@link Identifier}.
 */
type ConstructorArgs = {
  /** The identifier name */
  name: string
  /** Optional type name for typed identifiers */
  typeName?: string
  /** The entity type (variable, type, etc.) */
  entityType: EntityType
}

/**
 * Represents a TypeScript identifier in the SKMTC DSL system.
 * 
 * The `Identifier` class encapsulates named entities in generated code,
 * providing type-safe creation and management of variables, types, and other
 * identifiers. It distinguishes between different kinds of identifiers and
 * optionally tracks type information.
 * 
 * This class uses factory methods instead of direct construction to ensure
 * proper entity type classification and to provide a cleaner API.
 * 
 * ## Key Features
 * 
 * - **Type Safety**: Distinguishes between variables, types, and other entities
 * - **Factory Methods**: Provides semantic constructors for different identifier types
 * - **Optional Typing**: Can associate type information with variable identifiers
 * - **String Conversion**: Clean string representation for code generation
 * 
 * @example Creating variable identifiers
 * ```typescript
 * import { Identifier } from '@skmtc/core';
 * 
 * // Simple variable without type
 * const userName = Identifier.createVariable('userName');
 * console.log(userName.toString()); // 'userName'
 * 
 * // Typed variable
 * const userId = Identifier.createVariable('userId', 'string');
 * console.log(userId.name);     // 'userId'
 * console.log(userId.typeName); // 'string'
 * ```
 * 
 * @example Creating type identifiers
 * ```typescript
 * // Type identifier
 * const userType = Identifier.createType('User');
 * console.log(userType.toString());        // 'User'
 * console.log(userType.entityType.value); // 'type'
 * ```
 * 
 * @example Using in code generation
 * ```typescript
 * import { Definition, Identifier } from '@skmtc/core';
 * 
 * class ApiGenerator {
 *   generateFunction(name: string) {
 *     const funcId = Identifier.createVariable(name);
 *     const requestType = Identifier.createType('RequestType');
 *     
 *     return new Definition({
 *       name: funcId.name,
 *       content: `function ${funcId}(data: ${requestType}) {
 *         // Implementation
 *       }`
 *     });
 *   }
 * }
 * ```
 */
export class Identifier {
  /** The identifier name */
  name: string
  
  /** The entity type (variable, type, etc.) */
  entityType: EntityType
  
  /** Optional type name for typed variables */
  typeName?: string

  /**
   * Creates a new Identifier instance.
   * 
   * This constructor is private to enforce the use of factory methods
   * that provide better semantic clarity and type safety.
   * 
   * @param args - Identifier configuration
   */
  private constructor({ name, typeName, entityType }: ConstructorArgs) {
    this.name = name
    this.typeName = typeName
    this.entityType = entityType
  }

  /**
   * Creates a variable identifier with optional type information.
   * 
   * This factory method creates an identifier for variables, constants,
   * function parameters, and other value-based entities. Optionally
   * associates type information for typed variables.
   * 
   * @param name - The variable name
   * @param typeName - Optional type name for the variable
   * @returns A new variable Identifier instance
   * 
   * @example Untyped variable
   * ```typescript
   * const count = Identifier.createVariable('count');
   * console.log(count.name); // 'count'
   * console.log(count.typeName); // undefined
   * ```
   * 
   * @example Typed variable
   * ```typescript
   * const userId = Identifier.createVariable('userId', 'string');
   * console.log(userId.name);     // 'userId'
   * console.log(userId.typeName); // 'string'
   * ```
   * 
   * @example In function generation
   * ```typescript
   * const param = Identifier.createVariable('data', 'RequestData');
   * const funcDef = `function processRequest(${param.name}: ${param.typeName}) {}`;
   * ```
   */
  static createVariable(name: string, typeName?: string): Identifier {
    if (typeName) {
      return new Identifier({
        name,
        typeName,
        entityType: new EntityType('variable')
      })
    }

    return new Identifier({
      name,
      entityType: new EntityType('variable')
    })
  }

  /**
   * Creates a type identifier for TypeScript types.
   * 
   * This factory method creates an identifier for type entities like
   * interfaces, type aliases, classes, and other type-level constructs.
   * Type identifiers don't have associated type information since they
   * represent types themselves.
   * 
   * @param name - The type name
   * @returns A new type Identifier instance
   * 
   * @example Interface type
   * ```typescript
   * const userInterface = Identifier.createType('User');
   * console.log(userInterface.name);                // 'User'
   * console.log(userInterface.entityType.value);   // 'type'
   * ```
   * 
   * @example Type alias
   * ```typescript
   * const statusType = Identifier.createType('Status');
   * const typeDef = `type ${statusType} = 'pending' | 'complete'`;
   * ```
   * 
   * @example Generic type
   * ```typescript
   * const responseType = Identifier.createType('ApiResponse');
   * const genericDef = `interface ${responseType}<T> { data: T; success: boolean; }`;
   * ```
   */
  static createType(name: string): Identifier {
    return new Identifier({
      name,
      entityType: new EntityType('type')
    })
  }

  /**
   * Returns the string representation of the identifier.
   * 
   * This method simply returns the identifier name, which is the most
   * common usage when generating code. The name can be used directly
   * in code generation contexts.
   * 
   * @returns The identifier name as a string
   * 
   * @example
   * ```typescript
   * const variable = Identifier.createVariable('userName');
   * const typeId = Identifier.createType('User');
   * 
   * console.log(variable.toString()); // 'userName'
   * console.log(typeId.toString());   // 'User'
   * 
   * // Can be used directly in template strings
   * const code = `const ${variable}: ${typeId} = getUserData();`;
   * ```
   */
  toString(): string {
    return this.name
  }
}
