import { useArtifacts } from '@/components/preview/artifacts-context'
import { ArtifactsSidebar } from '@/components/preview/artifacts-sidebar'
import { SidebarRight } from '@/components/preview/sidebar-right'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
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
        <div className="flex flex-1 flex-col">
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
