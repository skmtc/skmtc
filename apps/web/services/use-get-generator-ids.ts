import { useQuery } from '@tanstack/react-query'
import { generatorsType } from '@/app/start/types'

type UseGetGeneratorIdsProps = {
  onSuccess: (generatorIds: string[]) => void
}

export const useGetGeneratorIds = ({ onSuccess }: UseGetGeneratorIdsProps) => {
  return useQuery({
    queryKey: ['generators'],
    queryFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/generators`)
        .then(res => res.json())
        .then(data => generatorsType.parse(data))
        .then(({ generators }) => onSuccess(generators))
    }
  })
}
