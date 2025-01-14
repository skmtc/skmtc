import { useArtifacts } from '@/components/preview/artifacts-context'
import { ArtifactsSidebar } from '@/components/preview/artifacts-sidebar'
import { SidebarRight } from '@/components/preview/sidebar-right'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'
import { useState } from 'react'
import { useGetArtifactsConfig } from '@/services/use-get-artifacts-config'
import { SchemaItem } from '@/components/config/types'

export const PreviewContainer = () => {
  const { webContainerUrl, iframeRef } = useWebcontainer()
  const { state: artifactsState } = useArtifacts()

  const [schemaItem, setSchemaItem] = useState<SchemaItem | null>(null)

  const { preview } = artifactsState

  useGetArtifactsConfig({
    schema: artifactsState.schema,
    clientSettings: artifactsState.clientSettings,
    preview: preview,
    onSuccess: data => setSchemaItem(data)
  })

  return (
    <SidebarProvider className="h-full">
      <ArtifactsSidebar previews={artifactsState.manifest?.previews} />
      <SidebarInset>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {preview ? (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="line-clamp-1">{preview.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {preview && webContainerUrl ? (
            <iframe
              className="w-full h-full"
              ref={iframeRef}
              src={`${webContainerUrl}${preview.route}`}
            />
          ) : (
            <div>Loading...</div>
          )}
        </div>
      </SidebarInset>
      {preview?.source?.type === 'operation' && (
        <SidebarRight schemaItem={schemaItem} source={preview?.source} />
      )}
    </SidebarProvider>
  )
}
