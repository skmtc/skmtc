import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import ArtifactsSidebar from '@/app/start/view-results/artifacts-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { CodeView } from '@/components/viewer/code-view'

export const ArtifactsCodeView = () => {
  return (
    <SidebarProvider className="h-full">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel className="flex relative" defaultSize={20}>
          <ArtifactsSidebar variant="inset" />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>
          <SidebarInset>
            <CodeView />
          </SidebarInset>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}
