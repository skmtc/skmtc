import { useEffect, useState } from 'react'
import { getApiGenerators } from '@/services/getApiGenerators.generated.ts'
import type { Generator } from '@/types/generator.generated.ts'
import { useSkmtc } from './SkmtcContext.tsx'

export const useGetGenerators = () => {
  const { state } = useSkmtc()
  const [generators, setGenerators] = useState<Generator[] | undefined>(undefined)

  useEffect(() => {
    getApiGenerators({ supabase: state.skmtcRoot.manager.auth.supabase }).then(res =>
      setGenerators(res)
    )
  }, [])

  return generators
}
