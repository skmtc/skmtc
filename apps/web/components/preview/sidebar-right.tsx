import * as React from 'react'
import { Sidebar, SidebarHeader, SidebarSeparator } from '@/components/ui/sidebar'
import { OperationPreview } from '@skmtc/core/Preview'
import { ColumnConfig } from '@/components/config/column-config'
import { FormConfig } from '@/components/config/form-config'
import { SchemaItem } from '@/components/config/types'
import { useArtifacts } from '@/components/artifacts-context'
import { InputConfig } from '@/components/config/input-config'

type SidebarRightProps = {
  schemaItem: SchemaItem | null
  source: OperationPreview
} & React.ComponentProps<typeof Sidebar>

export function SidebarRight({ schemaItem, source, ...props }: SidebarRightProps) {
  if (!schemaItem) {
    return null
  }

  const { state: artifactsState } = useArtifacts()
  const { previewItem } = artifactsState

  if (previewItem?.type !== 'component') {
    return null
  }

  const { preview } = previewItem

  return (
    <Sidebar
      key={schemaItem.name}
      collapsible="none"
      className="sticky hidden lg:flex top-0 border-l"
      {...props}
    >
      <SidebarHeader>
        <span className="font-semibold px-2 text-sm">{preview.name}</span>
      </SidebarHeader>
      <SidebarSeparator />
      {preview.group === 'tables' && <ColumnConfig source={source} schemaItem={schemaItem} />}
      {preview.group === 'forms' && <FormConfig source={source} schemaItem={schemaItem} />}
      {preview.group === 'inputs' && <InputConfig source={source} schemaItem={schemaItem} />}
    </Sidebar>
  )
}
