'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Controller, useForm } from 'react-hook-form'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { Loader2 } from 'lucide-react'
import { match, P } from 'ts-pattern'
import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'
import { useCreateArtifacts } from '@/services/use-create-artifacts'

type GeneratorsForm = {
  selectedGenerators: Record<string, boolean>
}

export const GeneratorMenu = () => {
  const { dispatch, state: artifactsState } = useArtifacts()

  const { control } = useForm<GeneratorsForm>({
    defaultValues: {
      selectedGenerators: artifactsState.selectedGenerators
    }
  })

  const { status } = useWebcontainer()

  const createArtifactsMutation = useCreateArtifacts({
    clientSettings: artifactsState.clientSettings,
    schema: artifactsState.schema,
    generatorSettings: artifactsState.clientSettings.generators,
    dispatch,
    enrichments: artifactsState.enrichments
  })

  return (
    <div className="flex flex-col flex-1">
      <div className="-space-y-px rounded-sm bg-white">
        {Object.keys(artifactsState.selectedGenerators).map((generatorId, generatorIndex) => (
          <Controller
            key={generatorId}
            name={`selectedGenerators.${generatorId}`}
            control={control}
            render={({ field: { value, onChange, ...field } }) => {
              const settings = artifactsState.clientSettings.generators.find(
                ({ id }) => id === generatorId
              )

              return (
                <label
                  key={generatorId}
                  aria-label={generatorId}
                  className={cn(
                    generatorIndex === 0 ? 'rounded-tl-sm rounded-tr-sm' : '',
                    generatorIndex === Object.keys(artifactsState.selectedGenerators).length - 1
                      ? 'rounded-bl-sm rounded-br-sm'
                      : '',
                    'has-[:disabled]bg-gray-50 has-[:disabled]:text-gray-500 has-[:disabled]:bg-gray-100 has-[:disabled]:border-gray-300 has-[:disabled]:shadow-none',
                    'group relative flex cursor-pointer border border-gray-300 px-4 py-2 focus:outline-none has-[:checked]:z-10 has-[:checked]:border-indigo-200 has-[:checked]:bg-indigo-50'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-white group-data-[checked]:border-transparent group-data-[checked]:bg-indigo-600 group-data-[focus]:ring-2 group-data-[focus]:ring-indigo-600 group-data-[focus]:ring-offset-2"
                  >
                    <div className="flex h-6 items-center">
                      <input
                        id="comments"
                        type="checkbox"
                        aria-describedby="comments-description"
                        className="size-4 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:text-gray-500"
                        checked={value}
                        onChange={event => {
                          onChange(event.target.checked)
                        }}
                      />
                    </div>
                  </span>
                  <span className="ml-3 flex flex-col gap-1">
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
          disabled={
            createArtifactsMutation.isPending ||
            artifactsState.clientSettings.generators.length === 0 ||
            status !== 'ready'
          }
          onClick={event => {
            event.preventDefault()
            createArtifactsMutation.mutate()
          }}
          className="bg-indigo-600 hover:bg-indigo-600/90 no-underline w-[200px]"
        >
          {createArtifactsMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            'Next: view results'
          )}
        </Button>
      </div>
    </div>
  )
}
