// Mock for ink's useApp hook
export let exitCalled = false
export let exitCallCount = 0

export const resetMocks = () => {
  exitCalled = false
  exitCallCount = 0
}

export const mockExit = () => {
  exitCalled = true
  exitCallCount++
}

export const mockUseApp = () => ({
  exit: mockExit
})
