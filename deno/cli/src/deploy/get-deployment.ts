import { createSupabaseClient } from '../auth/supabase-client.ts'

type GetDeploymentArgs = {
  deploymentId: string
}

export const getDeployment = async ({ deploymentId }: GetDeploymentArgs) => {
  const kv = await Deno.openKv()
  const supabase = createSupabaseClient({ kv })

  const { data: auth } = await supabase.auth.getSession()

  if (!auth?.session) {
    console.log('You are not logged in')

    kv.close()

    return
  }

  const { data, error } = await supabase.functions.invoke(
    `servers/${auth.session.user.user_metadata.user_name}/deployments/${deploymentId}`,
    {
      method: 'GET'
    }
  )

  if (error) {
    console.error('Error getting deployment', error)

    return
  }

  return data
}
