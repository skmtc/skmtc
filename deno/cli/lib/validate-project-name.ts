export type ProjectNameValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string }

/**
 * Validates a project name against business rules:
 * 1. Must be at least 3 characters long
 * 2. Must not already exist in the list of existing project names
 *
 * @param name - The project name to validate
 * @param existingProjectNames - Array of existing project names to check against
 * @returns Validation result with either the valid value or an error message
 */
export const validateProjectName = (
  name: string,
  existingProjectNames: string[]
): ProjectNameValidationResult => {
  // Length validation
  if (name.length < 3) {
    return {
      valid: false,
      error: 'Project name must be at least 3 characters long'
    }
  }

  // Duplicate validation (case-sensitive)
  const existingProject = existingProjectNames.find(existing => existing === name)
  if (existingProject) {
    return {
      valid: false,
      error: `Project "${name}" already exists`
    }
  }

  return { valid: true, value: name }
}
