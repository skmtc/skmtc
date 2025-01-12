import * as React from 'react'
import { ArtifactConfig } from '@/components/artifact-config'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import { OpenAPIV3 } from 'openapi-types'
import { OperationPreview } from '@skmtc/core/Preview'

type SidebarRightProps = {
  configSchema: OpenAPIV3.SchemaObject | null
  listItemName: string | null
  source: OperationPreview
} & React.ComponentProps<typeof Sidebar>

export function SidebarRight({ configSchema, listItemName, source, ...props }: SidebarRightProps) {
  return (
    <Sidebar collapsible="none" className="sticky hidden lg:flex top-0 border-l" {...props}>
      {/* <SidebarHeader className="h-16 border-b border-sidebar-border">
        <NavUser user={data.user} />
      </SidebarHeader> */}
      <SidebarContent className="pt-2">
        <ArtifactConfig configSchema={configSchema} listItemName={listItemName} source={source} />
      </SidebarContent>
      {/* <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <PlusIcon />
              <span>New Calendar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter> */}
    </Sidebar>
  )
}
