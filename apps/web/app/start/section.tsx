'use client'

import { Steps } from '@/app/start/steps'
import { ArtifactsProvider } from '@/components/artifacts/artifacts-context'
import { Header } from '@/components/ui/Header'
import { WebcontainerProvider } from '@/components/webcontainer/webcontainer-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FileSystemTree } from '@webcontainer/api'

const queryClient = new QueryClient()

type SectionProps = {
  fileNodes: FileSystemTree
  children: React.ReactNode
}

const Section = ({ children, fileNodes }: SectionProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WebcontainerProvider fileNodes={fileNodes}>
        <ArtifactsProvider>
          <div className="flex flex-col h-screen w-screen px-4 not-prose">
            <Header />

            <div className="flex flex-col flex-1 min-h-0 p-6 lg:px-8">
              <div className="flex flex-none h-8" />

              <Steps />

              <div className="flex flex-none h-8" />

              {children}
            </div>
          </div>
        </ArtifactsProvider>
      </WebcontainerProvider>
    </QueryClientProvider>
  )
}

export default Section
