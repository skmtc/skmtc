import { render } from 'ink-testing-library'
import { assertExists, assertStringIncludes, assertEquals } from '@std/assert'
import { HomeView } from '@/components/HomeView.tsx'
import { SkmtcProvider } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '../mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

Deno.test('HomeView - renders without errors', () => {
  const mockSession = createTestSession()
  
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {
      auth: {
        supabase: {
          functions: {
            invoke: () => Promise.resolve({ data: [], error: null })
          }
        }
      }
    }
  } as unknown as SkmtcRoot

  const { lastFrame, unmount } = render(
    <SkmtcProvider 
      view={{ page: 'home' }} 
      skmtcRoot={mockSkmtcRoot} 
      session={mockSession} 
      exit={mockExit}
      interactive
    >
      <HomeView />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  // Should contain basic options
  assertStringIncludes(output, 'Create new project')
  assertStringIncludes(output, 'Exit')
  
  unmount()
})

Deno.test('HomeView - shows no projects message when empty', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {
      auth: {
        supabase: {
          functions: {
            invoke: () => Promise.resolve({ data: [], error: null })
          }
        }
      }
    }
  } as unknown as SkmtcRoot

  const { lastFrame, unmount } = render(
    <SkmtcProvider 
      view={{ page: 'home' }} 
      skmtcRoot={mockSkmtcRoot} 
      session={mockSession} 
      exit={mockExit}
      interactive
    >
      <HomeView />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  // Should not show "Select a project" text when no projects
  assertEquals(output.includes('Select a project'), false)
  // Should show basic options
  assertStringIncludes(output, 'Create new project')
  assertStringIncludes(output, 'Exit')
  
  unmount()
})

Deno.test('HomeView - shows projects when available', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}

  const mockProjects = [
    { name: 'project-alpha' },
    { name: 'project-beta' }
  ]

  const mockSkmtcRoot = {
    projects: mockProjects,
    manager: {
      auth: {
        supabase: {
          functions: {
            invoke: () => Promise.resolve({ data: [], error: null })
          }
        }
      }
    }
  } as unknown as SkmtcRoot

  const { lastFrame, unmount } = render(
    <SkmtcProvider 
      view={{ page: 'home' }} 
      skmtcRoot={mockSkmtcRoot} 
      session={mockSession} 
      exit={mockExit}
      interactive
    >
      <HomeView />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  // Should show "Select a project" text when projects exist
  assertStringIncludes(output, 'Select a project')
  // Should show project names
  assertStringIncludes(output, 'project-alpha')
  assertStringIncludes(output, 'project-beta')
  // Should show basic options
  assertStringIncludes(output, 'Create new project')
  assertStringIncludes(output, 'Exit')
  
  unmount()
})