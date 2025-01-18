'use client'

import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import reapitSchema from './reapit-schema.json'
import { useRouter } from 'next/navigation'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { useGetGeneratorIds } from '@/services/use-get-generator-ids'
import { useEffect } from 'react'
import { StatusBar } from '@/components/webcontainer/status-bar'
import { cn } from '@/lib/utils'
import { inputClasses } from '@/lib/classes'

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
              onClick={() => field.onChange(JSON.stringify(reapitSchema, null, 2))}
              variant="link"
              className="text-indigo-600 no-underline hover:underline px-1"
            >
              Use example schema
            </Button>
          </div>

          <div className="flex flex-col flex-1 rounded-b-sm shadow-sm">
            <textarea
              placeholder="Paste your OpenAPI schema here..."
              id="schema"
              rows={10}
              className={cn(
                inputClasses,
                'flex-1 w-full rounded-b-none resize-none pt-2',
                'border-none shadow-none ring-1 ring-inset ring-gray-300  focus:ring-2 focus:ring-inset focus:ring-indigo-600'
              )}
              {...field}
            />
            <StatusBar />
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
