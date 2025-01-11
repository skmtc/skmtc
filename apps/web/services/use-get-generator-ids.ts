import { useQuery } from '@tanstack/react-query'
import { generatorsType } from '@/app/start/types'

export const useGetGeneratorIds = () => {
  return useQuery({
    queryKey: ['generators'],
    queryFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/generators`)
        .then(res => res.json())
        .then(data => generatorsType.parse(data))
    }
  })
}
