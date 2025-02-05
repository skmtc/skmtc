'use client'

import { useArtifacts } from '@/components/artifacts-context'
import { setPreviewApp } from '@/components/preview/set-preview-app'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { Preview } from '@skmtc/core/Preview'
import { Fragment, useEffect } from 'react'

type ArtifactsPreviewNavProps = {
  previews: Record<string, Record<string, Preview>> | undefined
}

export function ArtifactsPreviewNav({ previews }: ArtifactsPreviewNavProps) {
  const { state: artifactsState, dispatch } = useArtifacts()

  useEffect(() => {
    if (artifactsState.previewItem === null) {
      setPreviewApp({ dispatch, previews })
    }
  }, [previews, artifactsState.previewItem])

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden pt-0">
      {Object.entries(previews ?? {}).map(([group, items]) => (
        <Fragment key={group}>
          <SidebarGroupLabel className="uppercase sticky top-0 bg-sidebar rounded-none z-10">
            {group}
          </SidebarGroupLabel>
          <SidebarMenu>
            {Object.values(items ?? {}).map(preview => (
              <SidebarMenuItem key={`${preview.name}-${preview.exportPath}`}>
                <SidebarMenuButton
                  onClick={() => dispatch({ type: 'set-component-preview', payload: preview })}
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
