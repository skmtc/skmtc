import { assertEquals, assertRejects } from '@std/assert'
import { stub } from '@std/testing/mock'
import { listRegistryGenerators } from '@/services/listRegistryGenerators.ts'

const registryResponse = {
  items: [
    { scope: 'skmtc', name: 'gen-typescript', createdAt: '2024-01-01', latestVersion: '0.1.0' },
    { scope: 'skmtc', name: 'gen-zod', createdAt: '2024-01-01', latestVersion: '0.2.0' },
    { scope: 'skmtc', name: 'cli', createdAt: '2024-01-01', latestVersion: '0.4.0' },
    { scope: 'skmtc', name: 'gen-unpublished', createdAt: '2024-01-01', latestVersion: null }
  ]
}

Deno.test('listRegistryGenerators - returns published gen-* packages only', async () => {
  const fetchStub = stub(globalThis, 'fetch', () =>
    Promise.resolve(new Response(JSON.stringify(registryResponse), { status: 200 }))
  )

  try {
    const generators = await listRegistryGenerators()

    assertEquals(generators, [
      { scope: 'skmtc', packageName: 'gen-typescript', dependencies: [] },
      { scope: 'skmtc', packageName: 'gen-zod', dependencies: [] }
    ])
  } finally {
    fetchStub.restore()
  }
})

Deno.test('listRegistryGenerators - throws on a non-OK registry response', async () => {
  const fetchStub = stub(globalThis, 'fetch', () =>
    Promise.resolve(new Response('nope', { status: 500 }))
  )

  try {
    await assertRejects(
      () => listRegistryGenerators(),
      Error,
      'Failed to list packages from JSR registry (HTTP 500)'
    )
  } finally {
    fetchStub.restore()
  }
})
