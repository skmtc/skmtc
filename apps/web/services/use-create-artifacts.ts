import { useMutation } from '@tanstack/react-query'
import { ClientGeneratorSettings, ClientSettings } from '@skmtc/core/Settings'
import { ArtifactsDispatch, GeneratorEnrichments } from '@/components/preview/artifacts-context'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { match, P } from 'ts-pattern'

type UseCreateArtifactsArgs = {
  clientSettings: ClientSettings
  generatorSettings: ClientGeneratorSettings[] | undefined
  schema: string
  dispatch: ArtifactsDispatch
  enrichments: GeneratorEnrichments
}

export const useCreateArtifacts = ({
  clientSettings,
  enrichments,
  schema,
  generatorSettings,
  dispatch
}: UseCreateArtifactsArgs) => {
  const router = useRouter()

  return useMutation({
    mutationFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/artifacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientSettings: {
            ...clientSettings,
            generators:
              generatorSettings?.map(item => {
                return match(item)
                  .with({ operations: P.nonNullable }, operationSettings => {
                    const enrichedOperations = Object.fromEntries(
                      Object.entries(operationSettings.operations).map(([path, methods]) => {
                        const enrichedMethods = Object.fromEntries(
                          Object.entries(methods).map(([method, setting]) => {
                            const columnConfigs = enrichments?.[item.id]?.[path]?.[method]

                            return [
                              method,
                              columnConfigs?.length
                                ? {
                                    ...setting,
                                    enrichments: {
                                      columns: columnConfigs
                                    }
                                  }
                                : setting
                            ]
                          })
                        )

                        return [path, enrichedMethods]
                      })
                    )

                    return {
                      ...operationSettings,
                      operations: enrichedOperations
                    }
                  })
                  .with({ models: P.nonNullable }, modelSettings => {
                    return modelSettings
                  })
                  .exhaustive()
              }) ?? []
          },
          schema
        })
      }).then(res => res.json())
    },
    onSuccess: data => {
      console.log('RECEIVED ARTIFACTS', data.artifacts)
      console.log('RECEIVED MANIFEST', data.manifest)

      dispatch({ type: 'set-artifacts', payload: data.artifacts })
      dispatch({ type: 'set-manifest', payload: data.manifest })

      router.push('/start/view-results')
    },
    onError: (error: Error) => {
      console.error('ERROR', error)
      debugger
      toast('Failed to generate artifacts')
    }
  })
}
