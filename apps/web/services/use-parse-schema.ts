import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import type { OpenAPIV3 } from 'openapi-types'

type UseParseSchemaArgs = {
  onSuccess: (schema: OpenAPIV3.Document) => void
}
export const useParseSchema = ({ onSuccess }: UseParseSchemaArgs) => {
  return useMutation({
    mutationFn: (schema: string) => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/to-v3-json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schema
        })
      })
        .then(res => res.json())
        .then(data => z.object({ schema: z.record(z.unknown()) }).parse(data))
        .then(({ schema }) => onSuccess(schema as unknown as OpenAPIV3.Document))
    }
  })
}
