'use client'

import * as React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator
} from '@/components/ui/sidebar'
import { Preview } from '@skmtc/core/Preview'
import { ArtifactsPreviewNav } from '@/components/preview/artifacts-preview-nav'

type ArtifactsSidebarProps = {
  previews: Record<string, Record<string, Preview>> | undefined
} & React.ComponentProps<typeof Sidebar>

export function ArtifactsSidebar({ previews, ...props }: ArtifactsSidebarProps) {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <span className="truncate font-semibold px-2 text-sm">
          Foundations Interactive API Explorer
        </span>
      </SidebarHeader>
      <SidebarSeparator className="mb-2" />
      <SidebarContent>
        <ArtifactsPreviewNav previews={previews} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
