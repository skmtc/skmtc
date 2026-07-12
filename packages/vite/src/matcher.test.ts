import { describe, expect, it } from 'vitest'
import * as matcher from './matcher.ts'

// The subpath's contract with external hosts (the preview container
// harness): behavior is covered by source-state.test.ts / input-matcher.test.ts;
// this pins the exported SURFACE so a refactor can't silently drop what a
// host imports.
describe('matcher subpath surface', () => {
  it('exports what a harness host needs', () => {
    expect(typeof matcher.SourceState).toBe('function')
    expect(typeof matcher.matchInputs).toBe('function')
    expect(typeof matcher.moduleTypeFromDescribe).toBe('function')
    expect(typeof matcher.runDescribe).toBe('function')
    expect(typeof matcher.runGenerate).toBe('function')
  })
})
