/**
 * Global test setup file for SKMTC CLI tests.
 *
 * This file sets up the global test environment that is shared across all tests.
 * It sets a global flag that components can use to detect when they're running in tests.
 */

// Extend the globalThis type to include our test flag
declare global {
  var __DENO_TEST__: boolean | undefined
}

// Set the global test flag
globalThis.__DENO_TEST__ = true
