'use client'

import * as React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator
} from '@/components/ui/sidebar'
import { Preview } from '@skmtc/core/Preview'
import { ArtifactsPreviewNav } from '@/components/preview/artifacts-preview-nav'
import { GlobeIcon } from 'lucide-react'
import { useArtifacts } from '@/components/artifacts-context'
import { setPreviewApp } from '@/components/preview/set-preview-app'

type ArtifactsSidebarProps = {
  previews: Record<string, Record<string, Preview>> | undefined
} & React.ComponentProps<typeof Sidebar>

export function ArtifactsSidebar({ previews, ...props }: ArtifactsSidebarProps) {
  const { dispatch } = useArtifacts()

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <span className="truncate font-semibold px-2 text-sm">
          Foundations Interactive API Explorer
        </span>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setPreviewApp({ dispatch, previews })}>
              <GlobeIcon className="w-4 h-4" />
              <span>Preview</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <ArtifactsPreviewNav previews={previews} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
