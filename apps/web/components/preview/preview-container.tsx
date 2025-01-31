import { PreviewItem, useArtifacts } from '@/components/artifacts-context'
import { ArtifactsSidebar } from '@/components/preview/artifacts-sidebar'
import { SidebarRight } from '@/components/preview/sidebar-right'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useWebcontainer } from '@/components/webcontainer-context/webcontainer-context'
import { useState } from 'react'
import { useGetArtifactsConfig } from '@/services/use-get-artifacts-config'
import { SchemaItem } from '@/components/config/types'
import { LinkIcon } from 'lucide-react'
import { match } from 'ts-pattern'

export const PreviewContainer = () => {
  const { webContainerUrl, iframeRef } = useWebcontainer()
  const { state: artifactsState } = useArtifacts()
  const [schemaItem, setSchemaItem] = useState<SchemaItem | null>(null)

  const { previewItem } = artifactsState

  useGetArtifactsConfig({
    schema: artifactsState.schema,
    clientSettings: artifactsState.clientSettings,
    preview: previewItem?.type === 'component' ? previewItem.preview : null,
    onSuccess: data => setSchemaItem(data)
  })

  const previewRoute = toPreviewRoute(previewItem)

  return (
    <SidebarProvider className="h-full">
      <ArtifactsSidebar previews={artifactsState.manifest?.previews} />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-none items-center gap-2 text-sm  p-2 w-full bg-sidebar border-sidebar-border border-b-[1px] ">
            <LinkIcon className="w-4 h-4 text-sidebar-foreground/70" />
            {previewRoute && webContainerUrl ? previewRoute : ''}
          </div>
          {previewRoute && webContainerUrl ? (
            <iframe
              className="w-full h-full"
              ref={iframeRef}
              src={`${webContainerUrl}${previewRoute}`}
            />
          ) : (
            <div>Loading...</div>
          )}
        </div>
      </SidebarInset>
      {previewItem?.type === 'component' && previewItem.preview.source.type === 'operation' && (
        <SidebarRight schemaItem={schemaItem} source={previewItem.preview.source} />
      )}
    </SidebarProvider>
  )
}

const toPreviewRoute = (previewItem: PreviewItem | null) => {
  return match(previewItem)
    .with({ type: 'app' }, ({ route }) => route)
    .with({ type: 'component' }, ({ preview }) => preview.route)
    .otherwise(() => null)
}
