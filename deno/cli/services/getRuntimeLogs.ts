export type GetRuntimeLogsArgs = {
  accountName: string
  serverName: string
  spanId: string
  token: string
}

export const getRuntimeLogs = async ({
  accountName,
  serverName,
  spanId,
  token
}: GetRuntimeLogsArgs) => {
  const sandboxUrl = `https://skmtc-sandbox.dmitrigrabov.deno.net/${accountName}/${serverName}/${spanId}/logs`

  const res = await fetch(sandboxUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (!res.ok) {
    console.log('ERROR', await res.text())

    return null
  }

  const data = await res.json()

  return data
}
