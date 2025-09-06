import type { GenerateContext } from '../context/GenerateContext.ts'
import type { RegisterArgs } from '../context/GenerateContext.ts'
import type { GeneratorKey } from '../types/GeneratorKeys.ts'

/**
 * Constructor arguments for {@link ContentBase}.
 */
type ContentBaseArgs = {
  /** The generation context providing OAS objects and utilities */
  context: GenerateContext
  /** Optional generator key for tracking and identification */
  generatorKey?: GeneratorKey
}

/**
 * Base class for all content generators in the SKMTC DSL system.
 * 
 * `ContentBase` provides the foundation for creating custom generators that transform
 * OpenAPI Schema (OAS) objects into code artifacts. It handles registration with the
 * generation context, skipping logic, and provides access to the pipeline's utilities.
 * 
 * ## Generator Lifecycle
 * 
 * 1. **Construction**: Initialize with context and optional generator key
 * 2. **Registration**: Call {@link register} to add artifacts to the pipeline
 * 3. **Generation**: Implement custom logic using context utilities
 * 4. **Rendering**: Artifacts are automatically rendered by the pipeline
 * 
 * @example Basic generator
 * ```typescript
 * import { ContentBase } from '@skmtc/core';
 * 
 * class MyModelGenerator extends ContentBase {
 *   generate() {
 *     // Skip if not needed
 *     if (this.shouldSkip()) return;
 * 
 *     // Access OAS objects through context
 *     const schemas = this.context.oasDocument.components.schemas;
 * 
 *     for (const [name, schema] of Object.entries(schemas)) {
 *       if (schema.isRef()) continue;
 * 
 *       const file = new File({
 *         context: this.context,
 *         path: `./models/${name}.ts`,
 *         content: this.generateModelContent(schema)
 *       });
 * 
 *       // Register the file for rendering
 *       this.register({ file });
 *     }
 *   }
 * 
 *   private generateModelContent(schema: OasObject): string {
 *     // Custom model generation logic
 *     return `export interface ${schema.name} { ... }`;
 *   }
 * }
 * ```
 * 
 * @example Generator with skipping logic
 * ```typescript
 * class ConditionalGenerator extends ContentBase {
 *   generate() {
 *     // Check if generation should be skipped
 *     if (this.shouldSkipBasedOnSettings()) {
 *       this.skip('Disabled in settings');
 *       return;
 *     }
 * 
 *     // Continue with generation...
 *     const file = this.createOutputFile();
 *     this.register({ file });
 *   }
 * 
 *   private shouldSkipBasedOnSettings(): boolean {
 *     return this.context.settings?.skip?.models?.includes('MyModel') ?? false;
 *   }
 * }
 * ```
 */
export class ContentBase {
  /** The generation context providing access to OAS objects and utilities */
  context: GenerateContext
  
  /** Whether this generator has been skipped */
  skipped: boolean = false
  
  /** Optional generator key for identification and tracking */
  generatorKey: GeneratorKey | undefined

  /**
   * Creates a new ContentBase instance.
   * 
   * @param args - Construction arguments
   * @param args.context - The generation context
   * @param args.generatorKey - Optional generator key
   */
  constructor({ context, generatorKey }: ContentBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey
  }

  /**
   * Registers generated artifacts with the rendering pipeline.
   * 
   * This method is called by generator implementations to add files,
   * JSON artifacts, or other content to the generation output.
   * 
   * @param args - The artifacts to register
   * @param args.file - Optional file to register
   * @param args.jsonFile - Optional JSON file to register
   * 
   * @example Registering a file
   * ```typescript
   * const file = new File({
   *   context: this.context,
   *   path: './output.ts',
   *   content: 'export const value = 42;'
   * });
   * 
   * this.register({ file });
   * ```
   * 
   * @example Registering JSON data
   * ```typescript
   * const jsonFile = new JsonFile({
   *   context: this.context,
   *   path: './config.json',
   *   data: { version: '1.0.0', features: ['api'] }
   * });
   * 
   * this.register({ jsonFile });
   * ```
   */
  register(args: RegisterArgs): void {
    this.context.register(args)
  }
}
