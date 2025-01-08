'use client'

import { ArtifactsPreview } from '@/app/start/view-results/artifacts-preview'

const Page = () => {
  return (
    <div className="relative flex flex-col bg-background min-h-0">
      <div className="themes-wrapper bg-background flex flex-1 min-h-0 w-full">
        <ArtifactsPreview />
      </div>
    </div>
  )
}

export default Page
