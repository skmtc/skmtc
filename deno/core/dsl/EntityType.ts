import { match } from 'npm:ts-pattern@^5.8.0'

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
 * const varId = Identifier.createVariable('API_KEY', 'string');
 * console.log(varId.entityType.toString()); // 'const'
 * 
 * // Create a type identifier (uses 'type' keyword)
 * const typeId = Identifier.createType('UserStatus');
 * console.log(typeId.entityType.toString()); // 'type'
 * ```
 */
export class EntityType {
  /** The entity type discriminator */
  type: 'variable' | 'type'
  
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
  constructor(type: 'variable' | 'type') {
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
    return match(this.type)
      .with('variable', () => 'const')
      .with('type', () => 'type')
      .exhaustive()
  }
}
