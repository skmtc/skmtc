import type { GenerateContext } from '../context/GenerateContext.ts'
import type { Identifier } from './Identifier.ts'
import { ContentBase } from './ContentBase.ts'
import { withDescription } from '../typescript/withDescription.ts'
import type { GeneratedValue } from '../types/GeneratedValue.ts'

/**
 * Constructor arguments for {@link Definition}.
 *
 * @template V - The type of generated value this definition contains
 */
type ConstructorArgs<V extends GeneratedValue> = {
  /** The generation context providing pipeline access */
  context: GenerateContext
  /** Optional description for JSDoc comments */
  description?: string
  /** The identifier for this definition */
  identifier: Identifier
  /** The generated value content */
  value: V
  /** Whether to skip the export keyword */
  noExport?: boolean
}

/**
 * Represents a complete code definition in the SKMTC DSL system.
 *
 * The `Definition` class is the primary output unit of generators, representing
 * a complete piece of generated code (like an interface, function, or constant).
 * It combines an identifier, generated content, and optional metadata into a
 * formatted code definition with proper TypeScript syntax.
 *
 * This class automatically handles export statements, type annotations, and
 * JSDoc comment generation, making it the building block for all generated
 * code artifacts.
 *
 * ## Key Features
 *
 * - **Automatic Exports**: Handles export keyword based on configuration
 * - **Type Safety**: Preserves type information through generic parameters
 * - **JSDoc Integration**: Automatic comment generation from descriptions
 * - **Entity Type Support**: Handles different definition types (const, type, etc.)
 * - **Identifier Management**: Integrates with the Identifier system for naming
 *
 * @template V - The type of generated value (preserves generator-specific types)
 *
 * @example Basic interface definition
 * ```typescript
 * import { Definition, Identifier } from '@skmtc/core';
 *
 * const userInterface = new Definition({
 *   context: generateContext,
 *   identifier: Identifier.createType('User'),
 *   description: 'Represents a user in the system',
 *   value: {
 *     generatorKey: 'typescript-interfaces',
 *     content: `{
 *       id: string;
 *       name: string;
 *       email: string;
 *     }`
 *   }
 * });
 *
 * console.log(userInterface.toString());
 * //
 * // Represents a user in the system
 * //
 * // export type User = {
 * //   id: string;
 * //   name: string;
 * //   email: string;
 * // };
 * ```
 *
 * @example Function definition with parameters
 * ```typescript
 * const apiFunction = new Definition({
 *   context: generateContext,
 *   identifier: Identifier.createVariable('fetchUser', 'Promise<User>'),
 *   description: 'Fetches a user by ID from the API',
 *   value: {
 *     generatorKey: 'api-client',
 *     content: `async (id: string) => {
 *       const response = await fetch(\`/api/users/\${id}\`);
 *       return response.json();
 *     }`
 *   }
 * });
 *
 * console.log(apiFunction.toString());
 * //
 * //  Fetches a user by ID from the API
 * //
 * // export const fetchUser: Promise<User> = async (id: string) => {
 * //   const response = await fetch(`/api/users/${id}`);
 * //   return response.json();
 * // };
 * ```
 *
 * @example Non-exported definition
 * ```typescript
 * const helperFunction = new Definition({
 *   context: generateContext,
 *   identifier: Identifier.createVariable('validateEmail'),
 *   value: {
 *     generatorKey: 'utilities',
 *     content: `(email: string): boolean => {
 *       return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
 *     }`
 *   },
 *   noExport: true // Internal helper, not exported
 * });
 *
 * console.log(helperFunction.toString());
 * // const validateEmail = (email: string): boolean => {
 * //   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 * // };
 * ```
 *
 * @example Using in generator classes
 * ```typescript
 * import { ModelBase, Definition, Identifier } from '@skmtc/core';
 *
 * class TypeScriptInterface extends ModelBase {
 *   toDefinition(): Definition {
 *     const schema = this.context.getSchema(this.refName);
 *
 *     return new Definition({
 *       context: this.context,
 *       identifier: Identifier.createType(this.refName),
 *       description: schema.description,
 *       value: {
 *         generatorKey: this.generatorKey,
 *         content: this.generateInterfaceBody(schema)
 *       }
 *     });
 *   }
 * }
 * ```
 */
export class Definition<V extends GeneratedValue = GeneratedValue> extends ContentBase {
  /** The identifier for this definition */
  identifier: Identifier

  /** Optional description for JSDoc comments */
  description: string | undefined

  /** The generated value content */
  value: V

  /** Whether to skip the export keyword */
  noExport?: boolean

  /**
   * Creates a new Definition instance.
   *
   * @param args - Definition configuration
   * @param args.context - Generation context for pipeline access
   * @param args.identifier - The identifier (name and type info) for this definition
   * @param args.value - The generated content value
   * @param args.description - Optional description for JSDoc comments
   * @param args.noExport - Whether to omit the export keyword (default: false)
   *
   * @example
   * ```typescript
   * const constant = new Definition({
   *   context: generateContext,
   *   identifier: Identifier.createVariable('API_BASE_URL', 'string'),
   *   description: 'Base URL for all API requests',
   *   value: {
   *     generatorKey: 'constants',
   *     content: "'https://api.example.com'"
   *   }
   * });
   * ```
   */
  constructor({ context, identifier, value, description, noExport }: ConstructorArgs<V>) {
    super({ context, generatorKey: value.generatorKey })

    this.value = value
    this.identifier = identifier
    this.description = description
    this.noExport = noExport
  }

  /**
   * Generates the complete TypeScript definition code.
   *
   * This method produces a properly formatted TypeScript definition with:
   * - Optional JSDoc comments from the description
   * - Export keyword (unless noExport is true)
   * - Entity type (const, type, function, etc.)
   * - Identifier with optional type annotation
   * - Generated value content
   *
   * The output follows TypeScript syntax conventions and can be written
   * directly to a .ts file.
   *
   * @returns The complete TypeScript definition as a string
   *
   * @example Type definition
   * ```typescript
   * const typeDef = new Definition({
   *   context,
   *   identifier: Identifier.createType('Status'),
   *   description: 'Possible status values',
   *   value: { generatorKey: 'types', content: "'pending' | 'complete' | 'failed'" }
   * });
   *
   * console.log(typeDef.toString());
   * //
   * // Possible status values
   * //
   * // export type Status = 'pending' | 'complete' | 'failed';
   * ```
   *
   * @example Constant definition
   * ```typescript
   * const constDef = new Definition({
   *   context,
   *   identifier: Identifier.createVariable('DEFAULT_TIMEOUT', 'number'),
   *   value: { generatorKey: 'config', content: '5000' }
   * });
   *
   * console.log(constDef.toString());
   * // export const DEFAULT_TIMEOUT: number = 5000;
   * ```
   *
   * @todo Move syntax to typescript package to enable language-agnostic use
   */
  override toString(): string {
    const identifier = this.identifier.typeName
      ? `${this.identifier.name}: ${this.identifier.typeName}`
      : this.identifier.name

    // @TODO move syntax to typescript package to enable language agnostic use
    return withDescription(
      `${this.noExport ? '' : 'export '}${this.identifier.entityType} ${identifier} = ${this.value};\n`,
      {
        description: this.description
      }
    )
  }
}
