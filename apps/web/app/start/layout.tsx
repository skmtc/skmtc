'use client'

import { Steps } from '@/app/start/steps'
import { ArtifactsProvider } from '@/components/artifacts/artifacts-context'
import { Header } from '@/components/ui/Header'
import { WebcontainerProvider } from '@/components/webcontainer/webcontainer-context'
import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'

type GenerationForm = {
  schema: string
  generators: string[]
}

type LayoutProps = {
  children: React.ReactNode
}

const Layout = ({ children, ...props }: LayoutProps) => {
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
    <WebcontainerProvider>
      <ArtifactsProvider>
        <FormProvider {...form}>
          <div className="flex flex-col w-screen px-4">
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
  )
}

export default Layout
