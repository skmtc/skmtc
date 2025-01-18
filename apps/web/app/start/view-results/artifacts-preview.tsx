'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArtifactsCodeView } from '@/components/code-view/artifacts-code-view'
import { Button } from '@/components/ui/button'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'
import { useEffect } from 'react'
import { FileSystemTree } from '@webcontainer/api'
import { set } from 'lodash'
import { PreviewContainer } from '@/components/preview/preview-container'
import { useCreateArtifacts } from '@/services/use-create-artifacts'
import { useRouter } from 'next/navigation'
import { StatusBar } from '@/components/webcontainer/status-bar'

const downloadArtifacts = async (artifacts: Record<string, string>) => {
  const zip = new JSZip()

  Object.entries(artifacts).forEach(([name, content]) => {
    zip.file(name, content)
  })

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, 'artifacts.zip')
}

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
  const { artifacts } = artifactsState

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
              className="text-sm border-t border-x border-transparent data-[state=active]:border-gray-300 z-10"
            >
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="code"
              className="text-sm border-t border-x border-transparent data-[state=active]:border-gray-300 z-10"
            >
              Code
            </TabsTrigger>
            <div className="flex flex-1 justify-end">
              {Object.keys(artifactsState?.artifacts ?? {}).length > 0 && (
                <Button
                  onClick={() => downloadArtifacts(artifactsState.artifacts)}
                  variant="link"
                  className="text-indigo-600 no-underline hover:underline px-1"
                >
                  Download artifacts
                </Button>
              )}
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
