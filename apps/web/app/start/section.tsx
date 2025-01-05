'use client'

import { Steps } from '@/app/start/steps'
import { ArtifactsProvider } from '@/components/artifacts/artifacts-context'
import { Header } from '@/components/ui/Header'
import { WebcontainerProvider } from '@/components/webcontainer/webcontainer-context'
import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FileSystemTree } from '@webcontainer/api'

const queryClient = new QueryClient()

type GenerationForm = {
  schema: string
  generators: string[]
}

type SectionProps = {
  fileNodes: FileSystemTree
  children: React.ReactNode
}

const Section = ({ children, fileNodes }: SectionProps) => {
  const form = useForm<GenerationForm>({
    defaultValues: {
      schema: '',
      generators: []
    }
  })

  useEffect(() => {
    const { unsubscribe } = form.watch(value => {
      console.log(value)
    })
    return () => unsubscribe()
  }, [form.watch])

  return (
    <QueryClientProvider client={queryClient}>
      <WebcontainerProvider fileNodes={fileNodes}>
        <ArtifactsProvider>
          <FormProvider {...form}>
            <div className="flex flex-col h-screen w-screen px-4">
              <Header />

              <div className="flex flex-col flex-1 p-6 lg:px-8">
                <div className="h-16" />

                <Steps />

                <div className="h-16" />

                {children}
              </div>
            </div>
          </FormProvider>
        </ArtifactsProvider>
      </WebcontainerProvider>
    </QueryClientProvider>
  )
}

export default Section
