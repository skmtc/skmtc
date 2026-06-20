/**
 * Minimal PascalCase: split on non-alphanumeric runs, capitalize each
 * chunk's first letter, and preserve interior camelCase humps
 * (`newPet` → `NewPet`, `new-pet` → `NewPet`).
 */
export const toPascalCase = (input: string): string =>
  input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
