'use client'

import * as React from 'react'
import { TeamSwitcher } from '@/components/team-switcher'
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { Preview } from '@skmtc/core/Preview'
import { Command } from 'lucide-react'
import { ArtifactsPreviewNav } from '@/components/preview/artifacts-preview-nav'

type ArtifactsSidebarProps = {
  previews: Record<string, Record<string, Preview>> | undefined
} & React.ComponentProps<typeof Sidebar>

export function ArtifactsSidebar({ previews, ...props }: ArtifactsSidebarProps) {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={[
            {
              name: 'Foundations Interactive API Explorer',
              logo: Command,
              plan: 'Enterprise'
            }
          ]}
        />
      </SidebarHeader>
      <SidebarContent>
        <ArtifactsPreviewNav previews={previews} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
