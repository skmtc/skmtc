'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import clientSettings from './client.json'
import { toast } from 'sonner'
import { useArtifacts } from '@/components/artifacts/artifacts-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { generatorsType, generatorSettingsType } from '@/app/start/types'
import { match, P } from 'ts-pattern'
import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'

export const GeneratorMenu = () => {
  const { control } = useFormContext()
  const [submitting, setSubmitting] = useState(false)
  const { dispatch } = useArtifacts()
  const router = useRouter()
  const { status } = useWebcontainer()

  const schema = useWatch({ name: 'schema' })

  const generatorsResponse = useQuery({
    queryKey: ['generators'],
    queryFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/generators`)
        .then(res => res.json())
        .then(data => generatorsType.parse(data))
    }
  })

  const settingsMutation = useMutation({
    mutationFn: (schemaArg: string) => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/settings`, {
        method: 'POST',
        body: JSON.stringify({
          schema: schemaArg,
          defaultSelected: true
        })
      })
        .then(res => res.json())
        .then(data => generatorSettingsType.parse(data))
    }
  })

  useEffect(() => {
    if (schema && settingsMutation.isIdle) {
      settingsMutation.mutate(schema)
    }
  }, [schema])

  const artifactsMutation = useMutation({
    mutationFn: () => {
      return fetch(`${process.env.NEXT_PUBLIC_SKMTC_SERVER_ORIGIN}/artifacts`, {
        method: 'POST',
        body: JSON.stringify({
          clientSettings: {
            ...clientSettings,
            generators: settingsMutation.data?.generators
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

  return (
    <div className="flex flex-col flex-1">
      <div className="-space-y-px rounded-sm bg-white">
        {generatorsResponse.data?.generators.map((generatorId, generatorIndex) => (
          <Controller
            key={generatorId}
            name={generatorId}
            control={control}
            render={({ field }) => {
              const settings = settingsMutation.data?.generators.find(
                ({ id }) => id === generatorId
              )

              console.log('SETTINGS', settings)

              return (
                <label
                  key={generatorId}
                  // value={setting}
                  aria-label={generatorId}
                  // aria-description={setting.description}
                  className={cn(
                    generatorIndex === 0 ? 'rounded-tl-sm rounded-tr-sm' : '',
                    generatorIndex === generatorsResponse.data.generators.length - 1
                      ? 'rounded-bl-sm rounded-br-sm'
                      : '',
                    'has-[:disabled]bg-gray-50 has-[:disabled]:text-gray-500 has-[:disabled]:bg-gray-100 has-[:disabled]:border-gray-300 has-[:disabled]:shadow-none',
                    'group relative flex cursor-pointer border border-gray-300 p-4 focus:outline-none has-[:checked]:z-10 has-[:checked]:border-indigo-200 has-[:checked]:bg-indigo-50'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-white group-data-[checked]:border-transparent group-data-[checked]:bg-indigo-600 group-data-[focus]:ring-2 group-data-[focus]:ring-indigo-600 group-data-[focus]:ring-offset-2"
                  >
                    <div className="flex h-6 items-center">
                      <input
                        id="comments"
                        disabled={generatorId === '@skmtc/tanstack-query-zod'}
                        type="checkbox"
                        aria-describedby="comments-description"
                        className="size-4 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:text-gray-500"
                        checked={field.value}
                        {...field}
                      />
                    </div>
                  </span>
                  <span className="ml-3 flex flex-col">
                    <span className="block text-sm font-medium text-gray-900 group-data-[checked]:text-indigo-900">
                      {generatorId}
                    </span>
                    <span className="block text-sm text-gray-500 group-data-[checked]:text-indigo-700">
                      {match(settings)
                        .with({ models: P.nonNullable }, ({ models }) => {
                          return Object.entries(models).length
                        })
                        .with({ operations: P.nonNullable }, ({ operations }) => {
                          return Object.values(operations).reduce((acc, methods) => {
                            return acc + Object.values(methods).length
                          }, 0)
                        })
                        .otherwise(() => '-')}
                    </span>
                  </span>
                </label>
              )
            }}
          />
        ))}
      </div>
      <div className="flex mt-8 mb-12 justify-end ">
        <Button
          disabled={submitting || !settingsMutation.data || status !== 'ready'}
          onClick={event => {
            event.preventDefault()
            artifactsMutation.mutate()
          }}
          className="bg-indigo-600 hover:bg-indigo-600/90 no-underline w-[200px]"
        >
          {submitting ? <Loader2 className="animate-spin" /> : 'Next: view results'}
        </Button>
      </div>
    </div>
  )
}
