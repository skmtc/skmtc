import { join } from '@std/path/join'

interface MockReplacement {
  original: string
  backup: string
  mock: string
}

export class MockManager {
  private replacements: MockReplacement[] = [
    {
      original: join(Deno.cwd(), 'auth/supabase-client.ts'),
      backup: join(Deno.cwd(), 'auth/supabase-client.ts.backup'),
      mock: join(Deno.cwd(), 'tests/mocks/auth/supabase-client.ts'),
    },
    {
      original: join(Deno.cwd(), 'lib/jsr.ts'),
      backup: join(Deno.cwd(), 'lib/jsr.ts.backup'),
      mock: join(Deno.cwd(), 'tests/mocks/lib/jsr.ts'),
    },
    {
      original: join(Deno.cwd(), 'services/createApiServers.generated.ts'),
      backup: join(Deno.cwd(), 'services/createApiServers.generated.ts.backup'),
      mock: join(Deno.cwd(), 'tests/mocks/services/createApiServers.generated.ts'),
    },
  ]

  async setupMocks(): Promise<void> {
    for (const replacement of this.replacements) {
      try {
        // Backup original file
        await Deno.copyFile(replacement.original, replacement.backup)
        // Replace with mock
        await Deno.copyFile(replacement.mock, replacement.original)
      } catch (error) {
        console.warn(`Could not setup mock for ${replacement.original}:`, error)
      }
    }
  }

  async restoreMocks(): Promise<void> {
    for (const replacement of this.replacements) {
      try {
        // Restore original file
        await Deno.copyFile(replacement.backup, replacement.original)
        // Remove backup
        await Deno.remove(replacement.backup)
      } catch (error) {
        console.warn(`Could not restore mock for ${replacement.original}:`, error)
      }
    }
  }
}