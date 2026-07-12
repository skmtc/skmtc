export const mockServerResponse = {
  id: 'server-123',
  accountName: 'test-account',
  serverName: 'test-project',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

export const mockDeploymentResponse = {
  id: 'deployment-123',
  projectId: 'project-123',
  status: 'success' as const,
  url: 'https://test-project.deno.dev',
  createdAt: new Date().toISOString()
}

export const mockRuntimeLogs = [
  {
    message: JSON.stringify({ level: 'info', msg: 'Test log 1' }),
    timestamp: new Date().toISOString()
  },
  {
    message: JSON.stringify({ level: 'error', msg: 'Test error' }),
    timestamp: new Date().toISOString()
  }
]

export const mockManifestContents = {
  deploymentId: 'deployment-123',
  spanId: 'span-123',
  startAt: Date.now() - 60000,
  endAt: Date.now()
}
