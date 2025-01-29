import { useArtifacts } from '@/components/preview/artifacts-context'
import { ArtifactsSidebar } from '@/components/preview/artifacts-sidebar'
import { SidebarRight } from '@/components/preview/sidebar-right'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'
import { useState } from 'react'
import { useGetArtifactsConfig } from '@/services/use-get-artifacts-config'
import { SchemaItem } from '@/components/config/types'
import { LinkIcon } from 'lucide-react'

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

  console.log(JSON.stringify(schemaItem, null, 2))

  return (
    <SidebarProvider className="h-full">
      <ArtifactsSidebar previews={artifactsState.manifest?.previews} />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-none items-center gap-2 text-sm  p-2 w-full bg-sidebar border-sidebar-border border-b-[1px] ">
            <LinkIcon className="w-4 h-4 text-sidebar-foreground/70" />
            {preview && webContainerUrl ? preview.route : ''}
          </div>
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
