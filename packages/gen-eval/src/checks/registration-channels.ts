import type { PackageFacts, RegistrationChannels } from '../types.ts'

/**
 * Check 11 — informational: how output reaches Files. Driver-path
 * insert* / defineAndRegister call counts vs raw
 * register({ definitions }) with hand-built Definitions. Raw definition
 * registration bypasses the cache-identity and import-wiring machinery;
 * the baseline exists to reveal whether legitimate uses remain.
 * Docs: docs/registration-channels.md
 */

export const runRegistrationChannels = (facts: PackageFacts): RegistrationChannels => ({
  insertOperation: facts.files.reduce((total, file) => total + file.insertCalls.insertOperation, 0),
  insertModel: facts.files.reduce((total, file) => total + file.insertCalls.insertModel, 0),
  insertNormalizedModel: facts.files.reduce(
    (total, file) => total + file.insertCalls.insertNormalizedModel,
    0
  ),
  defineAndRegister: facts.files.reduce((total, file) => total + file.insertCalls.defineAndRegister, 0),
  rawDefinitionRegisters: facts.files.flatMap(file => file.rawDefinitionRegisters)
})
