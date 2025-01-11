import { useArtifacts } from '@/components/artifacts/artifacts-context'
import { ArtifactsSidebar } from '@/components/artifacts-sidebar'
import { SidebarRight } from '@/components/sidebar-right'
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
import { Preview } from '@skmtc/core/Preview'
import { OpenAPIV3 } from 'openapi-types'
import { useGetArtifactsConfig } from '@/services/use-get-artifacts-config'

export const PreviewContainer = () => {
  const [preview, setPreview] = useState<Preview | null>(null)
  const { webContainerUrl } = useWebcontainer()
  const { state: artifactsState } = useArtifacts()
  const [configSchema, setConfigSchema] = useState<OpenAPIV3.SchemaObject | null>(null)
  const [listItemName, setListItemName] = useState<string | null>(null)

  const generatorsResponse = useGetArtifactsConfig({
    schema: artifactsState.schema,
    clientSettings: artifactsState.clientSettings,
    path: preview?.route ?? null,
    generatorId: '@skmtc/elements-table', // TODO: make this dynamic - ideally add to preview object
    method: 'get', // TODO: make this dynamic - ideally add to preview object
    preview: preview,
    onSuccess: data => {
      setConfigSchema(data.listItemJson as OpenAPIV3.SchemaObject)
      setListItemName(data.listItemName)
    }
  })

  return (
    <SidebarProvider className="h-full">
      <ArtifactsSidebar previews={artifactsState.manifest?.previews} setPreview={setPreview} />
      <SidebarInset>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {preview ? (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="line-clamp-1">{preview.importName}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            ) : (
              <div>Loading...</div>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {preview ? (
            <iframe className="w-full h-full" src={`${webContainerUrl}${preview.route}`} />
          ) : null}
        </div>
      </SidebarInset>
      <SidebarRight configSchema={configSchema} listItemName={listItemName} />
    </SidebarProvider>
  )
}
