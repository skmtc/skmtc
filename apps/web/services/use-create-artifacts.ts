import { useMutation } from '@tanstack/react-query'
import { ClientGeneratorSettings, ClientSettings } from '@skmtc/core/Settings'
import { ArtifactsDispatch } from '@/components/artifacts/artifacts-context'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type UseCreateArtifactsArgs = {
  clientSettings: ClientSettings
  generatorSettings: ClientGeneratorSettings[] | undefined
  schema: string
  dispatch: ArtifactsDispatch
  setSubmitting: (submitting: boolean) => void
}

export const useCreateArtifacts = ({
  clientSettings,
  schema,
  generatorSettings,
  dispatch,
  setSubmitting
}: UseCreateArtifactsArgs) => {
  const router = useRouter()

  return useMutation({
    mutationFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/artifacts`, {
        method: 'POST',
        body: JSON.stringify({
          clientSettings: {
            ...clientSettings,
            generators: generatorSettings ?? []
          },
          schema
        })
      }).then(res => res.json())
    },
    onSuccess: data => {
      dispatch({ type: 'set-artifacts', payload: data.artifacts })
      dispatch({ type: 'set-manifest', payload: data.manifest })
      router.push('/start/view-results')
    },
    onError: () => {
      toast('Failed to generate artifacts')
    },
    onMutate: () => {
      setSubmitting(true)
    },
    onSettled: () => {
      setSubmitting(false)
    }
  })
}
