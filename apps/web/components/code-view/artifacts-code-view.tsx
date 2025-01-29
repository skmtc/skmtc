import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import ArtifactsSidebar from '@/app/start/view-results/artifacts-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { CodeView } from '@/components/code-view/code-view'
import { CSSProperties } from 'react'

export const ArtifactsCodeView = () => {
  return (
    <SidebarProvider className="h-full" style={{ '--sidebar-width': '100%' } as CSSProperties}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel className="flex relative" defaultSize={20}>
          <ArtifactsSidebar variant="inset" />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel style={{ overflowY: 'scroll' }}>
          <SidebarInset>
            <CodeView />
          </SidebarInset>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}
