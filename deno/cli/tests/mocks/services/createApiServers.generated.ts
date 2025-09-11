import { CreateServerBody } from '@/types/createServerBody.generated.ts'
import { server } from '@/types/server.generated.ts'
import { SupabaseClient, FunctionsHttpError } from '@supabase/supabase-js'

export type CreateApiServersArgs = {
  supabase: SupabaseClient
  body: CreateServerBody
}

export const createApiServers = async ({
  supabase,
  body,
}: CreateApiServersArgs) => {
  // Return mock server data
  const mockData = {
    id: 'test-server-id',
    serverName: body.serverName,
    latestDeploymentId: null,
    latestDenoDeploymentId: null,
    denoProjectName: body.serverName,
    latestStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return server.parse(mockData)
}