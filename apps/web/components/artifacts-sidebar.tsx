'use client'

import * as React from 'react'
import { TeamSwitcher } from '@/components/team-switcher'
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { Preview } from '@skmtc/core/Preview'
import { Command } from 'lucide-react'
import { ArtifactsPreviewNav } from '@/components/artifacts-preview-nav'

type ArtifactsSidebarProps = {
  previews: Record<string, Record<string, Preview>> | undefined
  setPreview: (preview: Preview) => void
} & React.ComponentProps<typeof Sidebar>

export function ArtifactsSidebar({ previews, setPreview, ...props }: ArtifactsSidebarProps) {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={[
            {
              name: 'Acme Inc',
              logo: Command,
              plan: 'Enterprise'
            }
          ]}
        />
      </SidebarHeader>
      <SidebarContent>
        <ArtifactsPreviewNav previews={previews} setPreview={setPreview} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
