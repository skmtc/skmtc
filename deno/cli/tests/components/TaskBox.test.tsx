import React from 'react'
import { render } from 'ink-testing-library'
import { assertExists, assertStringIncludes } from '@std/assert'
import { TaskBox } from '@/components/TaskBox.tsx'
import { Text } from 'ink'

Deno.test('TaskBox - renders children content', () => {
  const { lastFrame, unmount } = render(
    <TaskBox id="test-1" active>
      <Text>Test content</Text>
    </TaskBox>
  )

  const output = lastFrame()

  assertExists(output)
  
  assertStringIncludes(output, 'Test content')
  
  unmount()
})

Deno.test('TaskBox - renders with prompt', () => {
  const { lastFrame, unmount } = render(
    <TaskBox id="test-2" prompt="Enter your name:" active={false}>
      <Text>Child content</Text>
    </TaskBox>
  )

  const output = lastFrame()

  assertExists(output)
  
  assertStringIncludes(output, 'Enter your name:')
  assertStringIncludes(output, 'Child content')
  
  unmount()
})

Deno.test('TaskBox - renders without prompt', () => {
  const { lastFrame, unmount } = render(
    <TaskBox id="test-3" active={false}>
      <Text>Just children</Text>
    </TaskBox>
  )

  const output = lastFrame()

  assertExists(output)
  
  assertStringIncludes(output, 'Just children')
  // Should not have any prompt text
  
  unmount()
})