/**
 * Validates a project name against SKMTC naming conventions.
 * 
 * Ensures project names follow standard naming patterns suitable for package
 * managers and file systems. Names must be lowercase, contain only letters,
 * numbers, and hyphens, with specific length and format requirements.
 * 
 * @param name - The project name to validate
 * @returns An error message string if validation fails, undefined if valid
 * 
 * @example Valid project names
 * ```typescript
 * checkProjectName('my-api-client'); // undefined (valid)
 * checkProjectName('user-service');  // undefined (valid)
 * checkProjectName('api2');          // undefined (valid)
 * ```
 * 
 * @example Invalid project names
 * ```typescript
 * checkProjectName('A');             // 'Name must be at least 2 characters long'
 * checkProjectName('My-API-Client'); // 'Name must only contain lowercase letters, numbers and hyphens'
 * checkProjectName('-api-client');   // 'Name cannot start with a hyphen'
 * checkProjectName('api-client-');   // 'Name cannot end with a hyphen'
 * ```
 * 
 * @example Validation rules
 * - Minimum length: 2 characters
 * - Maximum length: 20 characters
 * - Allowed characters: a-z, 0-9, hyphens (-)
 * - Cannot start or end with hyphen
 * - Must be lowercase only
 */
export const checkProjectName = (name: string): string | undefined => {
  if (name.length < 2) {
    return 'Name must be at least 2 characters long'
  }

  if (name.length > 20) {
    return 'Name must be 20 characters or less'
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'Name must only contain lowercase letters, numbers and hyphens'
  }

  if (name.startsWith('-')) {
    return 'Name cannot start with a hyphen'
  }

  if (name.endsWith('-')) {
    return 'Name cannot end with a hyphen'
  }
}
