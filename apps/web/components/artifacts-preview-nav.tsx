'use client'

import { useArtifacts } from '@/components/artifacts/artifacts-context'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { Preview } from '@skmtc/core/Preview'
import { Fragment } from 'react'

type ArtifactsPreviewNavProps = {
  previews: Record<string, Record<string, Preview>> | undefined
}

export function ArtifactsPreviewNav({ previews }: ArtifactsPreviewNavProps) {
  const { dispatch } = useArtifacts()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      {Object.entries(previews ?? {}).map(([group, items]) => (
        <Fragment key={group}>
          <SidebarGroupLabel className="uppercase">{group}</SidebarGroupLabel>
          <SidebarMenu>
            {Object.values(items ?? {}).map(preview => (
              <SidebarMenuItem key={`${preview.name}-${preview.exportPath}`}>
                <SidebarMenuButton
                  onClick={() => dispatch({ type: 'set-preview', payload: preview })}
                >
                  {preview.name}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </Fragment>
      ))}
    </SidebarGroup>
  )
}
