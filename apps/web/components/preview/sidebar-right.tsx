import * as React from 'react'
import { Sidebar, SidebarSeparator } from '@/components/ui/sidebar'
import { OperationPreview } from '@skmtc/core/Preview'
import { ColumnConfig } from '@/components/config/column-config'
import { FormConfig } from '@/components/config/form-config'
import { SchemaItem } from '@/components/config/types'

type SidebarRightProps = {
  schemaItem: SchemaItem | null
  source: OperationPreview
} & React.ComponentProps<typeof Sidebar>

export function SidebarRight({ schemaItem, source, ...props }: SidebarRightProps) {
  if (!schemaItem) {
    return null
  }

  return (
    <Sidebar collapsible="none" className="sticky hidden lg:flex top-0 border-l" {...props}>
      <ColumnConfig source={source} schemaItem={schemaItem} />
      <SidebarSeparator />
      <FormConfig source={source} schemaItem={schemaItem} />
    </Sidebar>
  )
}
