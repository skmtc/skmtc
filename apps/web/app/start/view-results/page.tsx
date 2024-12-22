'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Viewer from '@/components/viewer/viewer'
import { ArtifactsCodeView } from '@/app/start/artifacts-code-view'
import { Button } from '@/components/ui/button'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useArtifacts } from '@/components/artifacts/artifacts-context'

const downloadArtifacts = async (artifacts: Record<string, string>) => {
  const zip = new JSZip()

  Object.entries(artifacts).forEach(([name, content]) => {
    zip.file(name, content)
  })

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, 'artifacts.zip')
}

const Page = () => {
  const { state } = useArtifacts()

  return (
    <Tabs defaultValue="preview" className="flex flex-col h-screen pt-16">
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
          {Object.keys(state.artifacts).length > 0 && (
            <Button
              onClick={() => downloadArtifacts(state.artifacts)}
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
        className="bg-white rounded-sm border border-gray-300 gap-4 flex-1 data-[state=active]:rounded-tl-none"
      >
        <Viewer />
      </TabsContent>
      <TabsContent value="code" className="bg-white rounded-sm border border-gray-300 gap-4 flex-1">
        <ArtifactsCodeView />
      </TabsContent>
    </Tabs>
  )
}

export default Page
