'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArtifactsCodeView } from '@/components/code-view/artifacts-code-view'
import { useArtifacts } from '@/components/artifacts-context'
import { useWebcontainer } from '@/components/webcontainer-context'
import { useEffect } from 'react'
import { FileSystemTree } from '@webcontainer/api'
import { set } from 'lodash'
import { PreviewContainer } from '@/components/preview/preview-container'
import { useCreateArtifacts } from '@/services/use-create-artifacts'
import { useRouter } from 'next/navigation'
import { StatusBar } from '@/components/webcontainer-context/status-bar'
import { ArtifactsDownload } from '@/app/start/view-results/artifacts-download'

const mungeFileTree = (fileTree: Record<string, string>): FileSystemTree => {
  const fileNodesAcc: FileSystemTree = {}

  Object.entries(fileTree).forEach(([key, value]) => {
    const path = key.split('/').flatMap((chunk, index, array) => {
      if (index !== array.length - 1) {
        return [chunk, 'directory']
      } else {
        return [chunk, 'file', 'contents']
      }
    })

    set(fileNodesAcc, path, value)
  })

  return fileNodesAcc
}

export const ArtifactsPreview = () => {
  const { state: artifactsState, dispatch } = useArtifacts()
  const { remount, status } = useWebcontainer()
  const { artifacts, downloadFileTree } = artifactsState

  const router = useRouter()

  useEffect(() => {
    if (!artifactsState.schema) {
      router.push('/start')
    }

    if (artifactsState.clientSettings.generators.length === 0) {
      router.push('/start/select-generators')
    }
  }, [artifactsState])

  const createArtifactsMutation = useCreateArtifacts({
    clientSettings: artifactsState.clientSettings,
    schema: artifactsState.schema,
    generatorSettings: artifactsState.clientSettings.generators,
    dispatch,
    enrichments: artifactsState.enrichments
  })

  useEffect(() => {
    if (!Object.keys(artifacts ?? {}).length || status !== 'ready') return

    const fileTree = mungeFileTree({ ...artifacts })

    remount(fileTree)
  }, [artifacts, status])

  useEffect(() => {
    createArtifactsMutation.mutate()
  }, [artifactsState.enrichments])

  return (
    <div className="relative flex flex-col bg-background min-h-0 pt-16">
      <div className="flex flex-col min-h-0 w-full shadow-sm rounded-sm">
        <Tabs defaultValue="preview" className="flex flex-col h-screen min-h-0">
          <TabsList className="justify-start">
            <TabsTrigger
              value="preview"
              className="text-sm border-t border-x border-transparent data-[state=active]:border-gray-300 data-[state=active]:bg-sidebar z-10"
            >
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="code"
              className="text-sm border-t border-x border-transparent data-[state=active]:border-gray-300 data-[state=active]:bg-sidebar z-10"
            >
              Code
            </TabsTrigger>
            <div className="flex flex-1 justify-end">
              <ArtifactsDownload artifacts={artifacts} downloadFileTree={downloadFileTree} />
            </div>
          </TabsList>
          <TabsContent
            value="preview"
            className="min-h-0 bg-white rounded-sm rounded-b-none border border-gray-300 gap-4 flex-1 data-[state=active]:rounded-tl-none relative overflow-x-hidden"
          >
            <PreviewContainer />
          </TabsContent>
          <TabsContent
            value="code"
            className="min-h-0 bg-white rounded-sm rounded-b-none border border-gray-300 gap-4 flex-1 relative"
          >
            <ArtifactsCodeView />
          </TabsContent>
        </Tabs>
        <StatusBar />
      </div>
    </div>
  )
}
