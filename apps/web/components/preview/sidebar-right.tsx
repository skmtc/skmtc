import * as React from 'react'
import { Sidebar, SidebarSeparator } from '@/components/ui/sidebar'
import { OpenAPIV3 } from 'openapi-types'
import { OperationPreview } from '@skmtc/core/Preview'
import { SidebarConfig } from '@/components/config/sidebar-config'

type SidebarRightProps = {
  configSchema: OpenAPIV3.SchemaObject | null
  listItemName: string | null
  source: OperationPreview
} & React.ComponentProps<typeof Sidebar>

export function SidebarRight({ configSchema, listItemName, source, ...props }: SidebarRightProps) {
  return (
    <Sidebar collapsible="none" className="sticky hidden lg:flex top-0 border-l" {...props}>
      <SidebarConfig source={source} configSchema={configSchema} listItemName={listItemName} />
      <SidebarSeparator />
    </Sidebar>
  )
}
