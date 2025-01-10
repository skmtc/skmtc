import * as React from 'react'
import { ArtifactConfig } from '@/components/artifact-config'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import { OpenAPIV3 } from 'openapi-types'

type SidebarRightProps = {
  configSchema: OpenAPIV3.SchemaObject | null
  listItemName: string | null
} & React.ComponentProps<typeof Sidebar>

export function SidebarRight({ configSchema, listItemName, ...props }: SidebarRightProps) {
  console.log('CONFIG SCHEMA', configSchema)

  return (
    <Sidebar collapsible="none" className="sticky hidden lg:flex top-0 border-l" {...props}>
      {/* <SidebarHeader className="h-16 border-b border-sidebar-border">
        <NavUser user={data.user} />
      </SidebarHeader> */}
      <SidebarContent className="pt-2">
        <ArtifactConfig configSchema={configSchema} listItemName={listItemName} />
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
