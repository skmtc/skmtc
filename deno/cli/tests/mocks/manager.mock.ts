import type { Manager } from '@/lib/manager.ts'

export function createMockManager(): Manager {
  return {
    cleanupActions: [],
    cleanup: async () => {}
  } as unknown as Manager
}
