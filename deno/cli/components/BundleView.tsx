import { Box } from 'ink'
import type { Project } from '@/lib/project.ts'
import type { ViewStateBundle } from '@/components/SkmtcContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect } from 'react'
import { createBundle } from '@/lib/create-bundle.ts'

type BundleViewProps = {
  project: Project
  view: ViewStateBundle
}

export const BundleView = ({ project, view }: BundleViewProps) => {
  const { state, dispatch, dispatchMessage, exit } = useSkmtc()

  useEffect(() => {
    const run = async () => {
      try {
        const bundlePath = await createBundle({ project })

        dispatchMessage({
          success: `Bundle created successfully at ${bundlePath}`
        })
      } catch (error) {
        dispatchMessage({
          error: error instanceof Error ? error.message : 'Failed to create bundle'
        })
      }

      if (state.interactive) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      } else {
        exit()
      }
    }

    run()
  }, [])

  return <Box></Box>
}
