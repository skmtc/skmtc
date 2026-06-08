import { EntityType } from '@/dsl/EntityType.ts'
import type { ImportNameArg } from '@/dsl/Import.ts'

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
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
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
   * Whether this identifier is exported.
   *
   * A language-neutral fact the engine never interprets — each language's
   * renderer decides what it means syntactically: TypeScript emits/omits
   * `export`, Go capitalizes the name (visibility via casing), others may
   * ignore it. Defaults to `true`.
   */
  exported: boolean

  /**
   * Creates a new Identifier instance.
   *
   * This constructor is private to enforce the use of factory methods
   * that provide better semantic clarity and type safety.
   *
   * @param args - Identifier configuration
   */
  private constructor({ name, typeName, entityType, exported }: ConstructorArgs) {
    this.name = name
    this.typeName = typeName
    this.entityType = entityType
    this.exported = exported ?? true
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
  static createVariable(name: string, typeName?: string, exported: boolean = true): Identifier {
    if (typeName) {
      return new Identifier({
        name,
        typeName,
        entityType: new EntityType('variable'),
        exported
      })
    }

    return new Identifier({
      name,
      entityType: new EntityType('variable'),
      exported
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
  static createType(name: string, exported: boolean = true): Identifier {
    return new Identifier({
      name,
      entityType: new EntityType('type'),
      exported
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

  /**
   * Builds an {@link ImportNameArg} that imports this identifier from
   * another module, threading the identifier's entity-type discriminator
   * through so the renderer can emit `import { type Foo }` for type-only
   * identifiers (avoiding TS1484 under `verbatimModuleSyntax: true`)
   * and a plain `import { Foo }` for variable identifiers.
   *
   * This is the canonical way for a Driver or Snippet to register an
   * import of a symbol it received as an `Identifier` — it eliminates
   * the hand-rolled `{ name, type: 'type' }` branch on
   * `identifier.entityType.type`.
   *
   * @param args.alias - Optional local alias. Renders as `Foo as Bar`
   *                     (or `type Foo as Bar` for type identifiers).
   *
   * @example Variable identifier
   * ```typescript
   * const id = Identifier.createVariable('useCustomer');
   * register({ imports: { './hooks': [id.toImport()] }, destinationPath });
   * // → import { useCustomer } from './hooks'
   * ```
   *
   * @example Type identifier
   * ```typescript
   * const id = Identifier.createType('UserDto');
   * register({ imports: { './types': [id.toImport()] }, destinationPath });
   * // → import { type UserDto } from './types'
   * //   (or `import type { UserDto } from './types'` when every name
   * //   in the statement is a type — the renderer picks the cleaner form)
   * ```
   *
   * @example With an alias
   * ```typescript
   * const id = Identifier.createType('User');
   * register({ imports: { './types': [id.toImport({ alias: 'IUser' })] }, destinationPath });
   * // → import { type User as IUser } from './types'
   * ```
   */
  toImport({ alias }: { alias?: string } = {}): ImportNameArg {
    const isType = this.entityType.type === 'type'
    if (isType) {
      // Type-only imports always emit the explicit object form so the
      // renderer can prefix with `type ` (or pick the statement-level
      // `import type { … }` form).
      return alias
        ? { name: this.name, alias, type: 'type' }
        : { name: this.name, type: 'type' }
    }
    // Variable imports match the canonical wire shape used by
    // `Import#toRecord`: bare string for plain value imports,
    // single-entry alias-record for aliased value imports.
    // Returning a bare string here means `register({ imports: [...]
    // })` consumers see the same shape as a hand-written
    // `imports: { 'x': ['Foo'] }` — preserving prior conventions and
    // keeping snapshot/equality-based tests stable.
    return alias ? { [this.name]: alias } : this.name
  }
}
