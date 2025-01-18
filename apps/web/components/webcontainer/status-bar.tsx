import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'
import { useEffect, useState } from 'react'
import { match } from 'ts-pattern'

export const StatusBar = () => {
  const { sharedStatusRef } = useWebcontainer()
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
    <div className="flex items-baseline gap-2 px-4 py-2 bg-black/[.025] border-b border-x rounded-b-sm border-gray-300 text-xs text-gray-400">
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
