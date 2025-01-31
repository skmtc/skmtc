import { useWebcontainer } from '@/components/webcontainer-context'
import { inputEdgeClasses } from '@/lib/classes'
import { inputClasses } from '@/lib/classes'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { match } from 'ts-pattern'

export const StatusBar = () => {
  const { sharedStatusRef, authHeader, setAuthHeader } = useWebcontainer()
  const [status, setStatus] = useState(sharedStatusRef.current)

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(sharedStatusRef.current)
    }, 50)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex justify-between w-full px-4 py-1 bg-black/[.025] border-b border-x rounded-b-sm border-gray-300 text-xs text-gray-400">
      <div className="flex items-center gap-2 h-6">
        {match(status)
          .with('idle', () => (
            <div className="self-center">
              <IndicatorDot />
            </div>
          ))
          .with('error', () => (
            <div className="text-red-600 self-center">
              <IndicatorDot />
            </div>
          ))
          .with('ready', () => (
            <div className="text-green-400 self-center">
              <IndicatorDot />
            </div>
          ))
          .otherwise(() => (
            <LinesSpinner key="busy" />
          ))}
        <span className="uppercase">{status}</span>
      </div>
      <AuthInput authHeader={authHeader} setAuthHeader={setAuthHeader} />
    </div>
  )
}

type AuthInputProps = {
  authHeader: string | null
  setAuthHeader: (authHeader: string | null) => void
}

const AuthInput = ({ authHeader, setAuthHeader }: AuthInputProps) => {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(authHeader ?? '')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(authHeader ?? '')
    }
  }, [open])

  const submit = () => {
    setAuthHeader(value)
    setOpen(false)
  }

  const cancel = () => {
    setOpen(false)
    setValue('')
  }

  useEffect(() => {
    if (focused) {
      return
    }

    const timeout = setTimeout(() => cancel(), 50)

    return () => clearTimeout(timeout)
  }, [focused])

  return (
    <div
      className="flex items-center gap-2"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
    >
      {open ? (
        <input
          className={cn(inputClasses, inputEdgeClasses, 'text-xs')}
          type="text"
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            match(event.key)
              .with('Enter', () => submit())
              .with('Escape', () => cancel())
              .otherwise(() => {})
          }}
        />
      ) : null}
      <button onClick={() => (open ? submit() : setOpen(true))}>
        {match(open)
          .with(true, () => 'Submit')
          .otherwise(() => (authHeader ? 'Edit auth header' : 'Set auth header'))}
      </button>
    </div>
  )
}

const LinesSpinner = () => {
  const items = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % items.length)
    }, 80)
    return () => clearInterval(interval)
  }, [])

  return <div className="w-3">{items[index]}</div>
}

const IndicatorDot = () => (
  <div className="flex-none text-current bg-current/10  rounded-full p-1">
    <div className="h-1 w-1 rounded-full bg-current"></div>
  </div>
)
