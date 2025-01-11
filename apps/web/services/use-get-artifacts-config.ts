import { Preview } from '@skmtc/core/Preview'
import { ClientSettings } from '@skmtc/core/Settings'
import { useQuery } from '@tanstack/react-query'
import { OpenAPIV3 } from 'openapi-types'

type Response = {
  listItemJson: OpenAPIV3.SchemaObject
  listItemName: string
}

type UseGetArtifactsConfigArgs = {
  schema: string
  clientSettings: ClientSettings
  path: string | null
  generatorId: string
  method: string
  preview: Preview | null
  onSuccess: (data: Response) => void
}

export const useGetArtifactsConfig = ({
  schema,
  clientSettings,
  path,
  generatorId,
  method,
  preview,
  onSuccess
}: UseGetArtifactsConfigArgs) => {
  return useQuery({
    queryKey: ['artifact-config', path, method],
    enabled: Boolean(preview),
    queryFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/artifact-config`, {
        method: 'POST',
        body: JSON.stringify({
          schema: schema,
          clientSettings: clientSettings,
          path: path,
          generatorId: generatorId,
          method: method
        })
      })
        .then(res => res.json())
        .then(data => onSuccess(data))
    }
  })
}
