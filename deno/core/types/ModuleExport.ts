import * as v from 'valibot'

/**
 * Valibot schema for validating module export configuration objects.
 * 
 * This schema validates module export structures used throughout the SKMTC
 * code generation pipeline. Module exports define how generated code modules
 * are exposed and imported, specifying both the export name and the file path
 * where the export can be found.
 * 
 * @example Validating a basic module export
 * ```typescript
 * import { moduleExport } from '@skmtc/core/types';
 * import * as v from 'valibot';
 * 
 * const config = {
 *   exportName: 'UserApi',
 *   exportPath: './generated/UserApi.ts'
 * };
 * 
 * const validated = v.parse(moduleExport, config);
 * console.log(validated.exportName); // 'UserApi'
 * ```
 * 
 * @example Validating multiple exports
 * ```typescript
 * const exports = [
 *   { exportName: 'createUser', exportPath: './api/users.ts' },
 *   { exportName: 'updateUser', exportPath: './api/users.ts' },
 *   { exportName: 'UserModel', exportPath: './models/User.ts' }
 * ];
 * 
 * exports.forEach(exp => {
 *   const validated = v.parse(moduleExport, exp);
 *   console.log(`Export: ${validated.exportName} from ${validated.exportPath}`);
 * });
 * ```
 */
export const moduleExport: v.GenericSchema<ModuleExport> = v.object({
  exportName: v.string(),
  exportPath: v.string()
})

/**
 * Configuration object for module exports in the SKMTC pipeline.
 * 
 * This type defines the structure for describing how generated code modules
 * should be exported and made available for import. It's used throughout
 * the SKMTC system for organizing generated code, managing dependencies,
 * and creating proper import/export relationships between generated files.
 * 
 * ## Usage in SKMTC Pipeline
 * 
 * This type is used by:
 * - Code generators to define export configurations
 * - File processors to organize generated modules
 * - Import managers to resolve module dependencies
 * - Build systems to understand code structure
 * 
 * @example Basic module export definition
 * ```typescript
 * import type { ModuleExport } from '@skmtc/core/types';
 * 
 * const apiExport: ModuleExport = {
 *   exportName: 'UserApiClient',
 *   exportPath: './generated/api/UserApiClient.ts'
 * };
 * 
 * console.log(`Import ${apiExport.exportName} from '${apiExport.exportPath}'`);
 * // Import UserApiClient from './generated/api/UserApiClient.ts'
 * ```
 * 
 * @example Function export configuration
 * ```typescript
 * const functionExport: ModuleExport = {
 *   exportName: 'validateUserData',
 *   exportPath: './generated/validators/userValidation.ts'
 * };
 * 
 * // Used to generate: export { validateUserData } from './generated/validators/userValidation.ts'
 * ```
 * 
 * @example Type export configuration
 * ```typescript
 * const typeExport: ModuleExport = {
 *   exportName: 'UserType',
 *   exportPath: './generated/types/User.ts'
 * };
 * 
 * // Used to generate: export type { UserType } from './generated/types/User.ts'
 * ```
 * 
 * @example Multiple exports from same file
 * ```typescript
 * const userModuleExports: ModuleExport[] = [
 *   {
 *     exportName: 'User',
 *     exportPath: './generated/models/User.ts'
 *   },
 *   {
 *     exportName: 'UserValidator',
 *     exportPath: './generated/models/User.ts'
 *   },
 *   {
 *     exportName: 'createUser',
 *     exportPath: './generated/models/User.ts'
 *   }
 * ];
 * 
 * // All exports reference the same file but different symbols
 * ```
 * 
 * @example Integration with build systems
 * ```typescript
 * class ModuleRegistry {
 *   private exports: ModuleExport[] = [];
 * 
 *   addExport(moduleExport: ModuleExport) {
 *     this.exports.push(moduleExport);
 *   }
 * 
 *   generateIndexFile(): string {
 *     return this.exports
 *       .map(exp => `export { ${exp.exportName} } from '${exp.exportPath}';`)
 *       .join('\n');
 *   }
 * }
 * 
 * const registry = new ModuleRegistry();
 * registry.addExport({
 *   exportName: 'ApiClient',
 *   exportPath: './api/client.ts'
 * });
 * ```
 */
export type ModuleExport = {
  /** The name of the symbol being exported (function, class, type, etc.) */
  exportName: string
  /** The file path where the export can be found */
  exportPath: string
}
