'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import clientSettings from './client.json'
import { toast } from 'sonner'
import { useArtifacts } from '@/components/artifacts/artifacts-context'
import { useRouter } from 'next/navigation'
import { MouseEvent, useState } from 'react'
import { Loader2 } from 'lucide-react'

const generators = [
  {
    name: '@skmtc/typescript',
    description: 'Generate TypeScript types from your schema'
  },
  {
    name: '@skmtc/zod',
    description: 'Generate Zod types from your schema'
  },
  {
    name: '@skmtc/tanstack-query-zod',
    description: 'Generate Zod types from your schema'
  },
  {
    name: '@skmtc/shadcn-forms',
    description: 'Generate Zod types from your schema'
  },
  {
    name: '@skmtc/shadcn-tables',
    description: 'Generate Zod types from your schema'
  }
]

export const GeneratorMenu = () => {
  const { control } = useFormContext()
  const [submitting, setSubmitting] = useState(false)
  const { dispatch } = useArtifacts()
  const router = useRouter()

  const schema = useWatch({ name: 'schema' })

  const handleSubmit = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    
    setSubmitting(true)

    const response = await fetch('https://windy-frog-48-6gh0rq9w9x61.deno.dev/artifacts', {
      method: 'POST',
      body: JSON.stringify({
        clientSettings,
        schema
      })
    })

    if (response.ok) {
      const { artifacts, manifest } = await response.json()

      dispatch({ type: 'set-artifacts', payload: artifacts })
      dispatch({ type: 'set-manifest', payload: manifest })

      router.push('/start/view-results')
    } else {
      toast('Failed to generate artifacts')
    }

    setSubmitting(false)
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="-space-y-px rounded-sm bg-white">
        {generators.map((setting, settingIdx) => (
          <Controller
            key={setting.name}
            name={setting.name}
            control={control}
            render={({ field }) => {
              return (
                <label
                  key={setting.name}
                  // value={setting}
                  aria-label={setting.name}
                  aria-description={setting.description}
                  className={cn(
                    settingIdx === 0 ? 'rounded-tl-sm rounded-tr-sm' : '',
                    settingIdx === generators.length - 1 ? 'rounded-bl-sm rounded-br-sm' : '',
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
                        disabled={setting.name === '@skmtc/tanstack-query-zod'}
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
                      {setting.name}
                    </span>
                    <span className="block text-sm text-gray-500 group-data-[checked]:text-indigo-700">
                      {setting.description}
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
          disabled={submitting}
          onClick={event => handleSubmit(event)}
          className="bg-indigo-600 hover:bg-indigo-600/90 no-underline w-[200px]"
        >
          {submitting ? <Loader2 className="animate-spin" /> : 'Next: view results'}
        </Button>
      </div>
    </div>
  )
}
