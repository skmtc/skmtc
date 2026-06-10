import { useEffect, useState } from 'react'
import { listRegistryGenerators } from '@/services/listRegistryGenerators.ts'
import type { Generator } from '@/types/generator.ts'

export const useGetGenerators = () => {
  const [generators, setGenerators] = useState<Generator[] | undefined>(undefined)

  useEffect(() => {
    listRegistryGenerators().then(items => {
      setGenerators(items.toSorted((a, b) => a.packageName.localeCompare(b.packageName)))
    })
  }, [])

  return generators
}
