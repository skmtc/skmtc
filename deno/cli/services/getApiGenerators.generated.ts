import { generator } from '@/types/generator.generated.ts'
import { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const generators = z.array(generator)

export type GetApiGeneratorsArgs = {
  supabase: SupabaseClient
}

export const getApiGenerators = async ({ supabase }: GetApiGeneratorsArgs) => {
  const { data, error } = await supabase.functions.invoke(`/generators`, {
    method: 'GET'
  })

  if (error) {
    throw new Error(`Failed to get generators`)
  }

  return generators.parse(data)
}
