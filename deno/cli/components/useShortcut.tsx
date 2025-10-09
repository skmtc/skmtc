import { useEffect, useId } from 'react'
import type { Key } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'

type UseShortcutArgs = {
  key: string
  name: string
  action: (input: string, key: Key) => void
}

export const useShortcut = ({ key, name, action }: UseShortcutArgs) => {
  const { state, dispatch } = useSkmtc()
  const shortcutId = useId()

  useEffect(() => {
    if (!state.interactive && key === 'esc') {
      return
    }

    dispatch({
      type: 'add-shortcut',
      payload: {
        id: shortcutId,
        label: `'${key}' to ${name}`,
        action
      }
    })

    return () => {
      dispatch({ type: 'remove-shortcut', payload: shortcutId })
    }
  }, [])
}
