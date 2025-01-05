'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArtifactsCodeView } from '@/app/start/artifacts-code-view'
import { Button } from '@/components/ui/button'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useArtifacts } from '@/components/artifacts/artifacts-context'
import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'
import { useEffect } from 'react'
import { Router } from '@/components/viewer/router'
import { FileSystemTree } from '@webcontainer/api'
import { set } from 'lodash'

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

const Page = () => {
  const { state } = useArtifacts()
  const { remount, status, webContainerUrl } = useWebcontainer()
  const { artifacts, manifest } = state

  useEffect(() => {
    if (!Object.keys(artifacts).length || status !== 'ready') return

    const routerApp = `${new Router(manifest?.previews ?? {})}`

    const fileTree = mungeFileTree({
      ...artifacts,
      'src/App.tsx': routerApp
    })

    remount(fileTree)
  }, [artifacts, status])

  if (!webContainerUrl) return <div>Loading...</div>

  return (
    <div className="flex flex-col gap-16">
      {Object.entries(manifest?.previews ?? {}).map(([group, imports]) => {
        return Object.keys(imports).map(importName => {
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
                <iframe
                  className="w-full h-full"
                  src={`${webContainerUrl}/${group}/${importName}`}
                />
              </TabsContent>
              <TabsContent
                value="code"
                className="bg-white rounded-sm border border-gray-300 gap-4 flex-1"
              >
                <ArtifactsCodeView />
              </TabsContent>
            </Tabs>
          )
        })
      })}
    </div>
  )
}

export default Page
