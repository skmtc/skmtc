import { useEffect, useId } from 'react'
import type { Key } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'

type UseShortcutArgs = {
  label: string
  action: (input: string, key: Key) => void
}

export const useShortcut = ({ label, action }: UseShortcutArgs) => {
  const { dispatch } = useSkmtc()
  const shortcutId = useId()

  useEffect(() => {
    dispatch({
      type: 'add-shortcut',
      payload: {
        id: shortcutId,
        label,
        action
      }
    })

    return () => {
      dispatch({ type: 'remove-shortcut', payload: shortcutId })
    }
  }, [])
}
