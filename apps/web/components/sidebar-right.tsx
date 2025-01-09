import * as React from 'react'
import { ArtifactConfig } from '@/components/artifact-config'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import { OpenAPIV3 } from 'openapi-types'
// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg'
  },
  calendars: [
    {
      name: 'My Calendars',
      items: ['Personal', 'Work', 'Family']
    },
    {
      name: 'Favorites',
      items: ['Holidays', 'Birthdays']
    },
    {
      name: 'Other',
      items: ['Travel', 'Reminders', 'Deadlines']
    }
  ]
}

type SidebarRightProps = {
  configSchema: OpenAPIV3.SchemaObject | null
} & React.ComponentProps<typeof Sidebar>

export function SidebarRight({ configSchema, ...props }: SidebarRightProps) {
  console.log('CONFIG SCHEMA', configSchema)

  return (
    <Sidebar collapsible="none" className="sticky hidden lg:flex top-0 border-l" {...props}>
      {/* <SidebarHeader className="h-16 border-b border-sidebar-border">
        <NavUser user={data.user} />
      </SidebarHeader> */}
      <SidebarContent className="pt-2">
        <ArtifactConfig configSchema={configSchema} />
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
