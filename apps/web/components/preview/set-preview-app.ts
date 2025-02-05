import { ArtifactsDispatch } from '@/components/artifacts-context'
import { Preview } from '@skmtc/core/Preview'

type SetPreviewAppArgs = {
  dispatch: ArtifactsDispatch
  previews: Record<string, Record<string, Preview>> | undefined
}

export const setPreviewApp = ({ dispatch, previews }: SetPreviewAppArgs) => {
  const items = Object.values(previews ?? {}).at(0)

  if (!items) {
    return
  }

  const preview = Object.values(items ?? {}).at(0)

  if (preview?.route) {
    // @todo: preview app should have static home page
    dispatch({
      type: 'set-preview-route',
      payload: preview.route
    })
  }
}
