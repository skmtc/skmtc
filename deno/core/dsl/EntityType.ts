
/**
 * Represents the type of a TypeScript entity for code generation.
 * 
 * `EntityType` encapsulates the distinction between different kinds of
 * TypeScript entities, specifically variables (which become `const` declarations)
 * and types (which become `type` or `interface` declarations).
 * 
 * This class is used by the {@link Identifier} system to ensure that
 * generated code uses the correct TypeScript keywords and syntax patterns.
 * 
 * @example Variable entity type
 * ```typescript
 * import { EntityType } from '@skmtc/core';
 * 
 * const variableEntity = new EntityType('variable');
 * console.log(variableEntity.toString()); // 'const'
 * 
 * // Used in code generation:
 * // const API_URL = 'https://api.example.com';
 * ```
 * 
 * @example Type entity type
 * ```typescript
 * const typeEntity = new EntityType('type');
 * console.log(typeEntity.toString()); // 'type'
 * 
 * // Used in code generation:
 * // type User = { id: string; name: string; };
 * ```
 * 
 * @example Integration with Identifier
 * ```typescript
 * import { Identifier, EntityType } from '@skmtc/core';
 * 
 * // Create a variable identifier (uses 'const' keyword)
 * const varId = Identifier.createVariable('API_KEY', { typeName: 'string' });
 * console.log(varId.entityType.toString()); // 'const'
 * 
 * // Create a type identifier (uses 'type' keyword)
 * const typeId = Identifier.createType('UserStatus');
 * console.log(typeId.entityType.toString()); // 'type'
 * ```
 */
/**
 * The discriminator string an entity-type carries.
 *
 * Shared between {@link EntityType} (the class that wraps it and adds
 * the `'const' | 'type'` keyword mapping) and the concise import form
 * each language package's register vocabulary accepts (its `type`
 * field), so an {@link Identifier} can hand its `entityType.type`
 * directly to `register({ imports })` without instantiating a new
 * EntityType.
 *
 * - `'variable'` — value imports (`import { Foo }`) and `const`
 *   declarations.
 * - `'type'` — type-only imports (`import { type Foo }` /
 *   `import type { Foo }`) and `type` / `interface` declarations.
 */
export type EntityTypeValue = 'variable' | 'type'

export class EntityType {
  /** The entity type discriminator */
  type: EntityTypeValue

  /**
   * Creates a new EntityType instance.
   *
   * @param type - The type of entity ('variable' for const declarations, 'type' for type declarations)
   *
   * @example
   * ```typescript
   * // For generating const declarations
   * const constEntity = new EntityType('variable');
   *
   * // For generating type declarations
   * const typeEntity = new EntityType('type');
   * ```
   */
  constructor(type: EntityTypeValue) {
    this.type = type
  }

  /**
   * Returns the appropriate TypeScript keyword for this entity type.
   * 
   * This method maps the entity type to the correct TypeScript declaration
   * keyword that should be used in generated code:
   * - 'variable' entities become 'const' declarations
   * - 'type' entities become 'type' declarations
   * 
   * @returns The TypeScript keyword string ('const' or 'type')
   * 
   * @example
   * ```typescript
   * const varEntity = new EntityType('variable');
   * console.log(varEntity.toString()); // 'const'
   * 
   * const typeEntity = new EntityType('type');
   * console.log(typeEntity.toString()); // 'type'
   * 
   * // Used in code generation:
   * const keyword = entityType.toString();
   * const declaration = `${keyword} ${identifier} = ${value};`;
   * // Results in: "const API_URL = 'https://example.com';" or
   * // Results in: "type Status = 'active' | 'inactive';"
   * ```
   */
  toString(): string {
    switch (this.type) {
      case 'variable':
        return 'const';
      case 'type':
        return 'type';
      default: {
        const _exhaustive: never = this.type;
        throw new Error(`Unhandled entity type: ${_exhaustive}`);
      }
    }
  }
}
