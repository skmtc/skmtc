'use client'

import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import exampleSchema from './example-schema.json'
import { useRouter } from 'next/navigation'
import { useArtifacts } from '@/components/artifacts/artifacts-context'
import { useGetGeneratorIds } from '@/services/use-get-generator-ids'
import { useEffect } from 'react'

type SchemaForm = {
  schema: string
}

export const UploadSchema = () => {
  const { state: artifactsState, dispatch } = useArtifacts()

  const { control } = useForm<SchemaForm>({
    defaultValues: {
      schema: artifactsState.schema
    }
  })

  const router = useRouter()

  const generatorIdsResponse = useGetGeneratorIds()

  useEffect(() => {
    if (generatorIdsResponse.isSuccess) {
      const { generators } = generatorIdsResponse.data

      dispatch({
        type: 'set-selected-generators',
        payload: Object.fromEntries(generators.map(generator => [generator, true]))
      })
    }
  }, [generatorIdsResponse.data])

  return (
    <Controller
      name="schema"
      control={control}
      render={({ field }) => (
        <div className="flex flex-col flex-1 col-span-full">
          <div className="flex justify-between items-center">
            <label htmlFor="schema" className="block text-sm/6 font-medium text-gray-900">
              OpenAPI Schema
            </label>
            <Button
              onClick={() => field.onChange(JSON.stringify(exampleSchema, null, 2))}
              variant="link"
              className="text-indigo-600 no-underline hover:underline px-1"
            >
              Use example schema
            </Button>
          </div>

          <div className="flex flex-col flex-1 mt-2">
            <textarea
              id="schema"
              rows={10}
              className="flex flex-col flex-1 w-full rounded-sm border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm/6"
              {...field}
            />
          </div>

          <div className="flex mt-8 mb-12 justify-end ">
            <Button
              disabled={!field.value}
              className="bg-indigo-600 hover:bg-indigo-600/90 no-underline"
              onClick={event => {
                event.preventDefault()

                dispatch({ type: 'set-schema', payload: field.value })

                router.push('/start/select-generators')
              }}
            >
              Next: select generators
            </Button>
          </div>
        </div>
      )}
    />
  )
}
