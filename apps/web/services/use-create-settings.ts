import { useMutation } from '@tanstack/react-query'
import { GeneratorSettingsType, generatorSettingsType } from '@/app/start/types'

type UseCreateSettingsArgs = {
  onSuccess: (generatorsSettings: GeneratorSettingsType) => void
}

export const useCreateSettings = ({ onSuccess }: UseCreateSettingsArgs) => {
  return useMutation({
    mutationFn: (schema: string) => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/settings`, {
        method: 'POST',
        body: JSON.stringify({
          schema,
          defaultSelected: true
        })
      })
        .then(res => res.json())
        .then(data => generatorSettingsType.parse(data))
        .then(generatorsSettings => onSuccess(generatorsSettings))
    }
  })
}
