import { SchemaItem } from '@/components/config/types'
import { OperationPreview, Preview } from '@skmtc/core/Preview'
import { ClientSettings } from '@skmtc/core/Settings'
import { useQuery } from '@tanstack/react-query'

type UseGetArtifactsConfigArgs = {
  schema: string
  clientSettings: ClientSettings
  preview: Preview | null
  onSuccess: (data: SchemaItem) => void
}

export const useGetArtifactsConfig = ({
  schema,
  clientSettings,
  preview,
  onSuccess
}: UseGetArtifactsConfigArgs) => {
  const { generatorId, operationPath, operationMethod } = (preview?.source ??
    {}) as OperationPreview

  useQuery({
    queryKey: ['artifact-config', operationPath, operationMethod],
    enabled: Boolean(preview),
    queryFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/artifact-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schema: schema,
          clientSettings: clientSettings,
          source: {
            type: 'operation',
            operationPath: operationPath,
            generatorId: generatorId,
            operationMethod: operationMethod
          }
        })
      })
        .then(res => res.json())
        .then(data => {
          onSuccess(data.schemaItem)
          return data.schemaItem
        })
    }
  })
}
