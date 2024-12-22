import React, { ReactNode, RefObject, useEffect, useLayoutEffect } from "react"

const ObserverContext = React.createContext<IntersectionObserver | undefined>(
  undefined,
)
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

type ScrollerProps = {
  onIndexChange: (index: number) => void
  triggerPosition?: TriggerPosition
  rootMargin?: string
  children: ReactNode
  parentRef: RefObject<HTMLDivElement>
}

export function Scroller({
  onIndexChange,
  triggerPosition = "600px",
  rootMargin,
  children,
  parentRef,
}: ScrollerProps) {
  const [observer, setObserver] = React.useState<IntersectionObserver>()
  const vh = useWindowHeight(parentRef.current)

  useIsomorphicLayoutEffect(() => {
    const windowHeight = vh || 0

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio > 0) {
          // get entry.target index
          const index = entry.target.getAttribute("data-index")
          onIndexChange(+index!)
        }
      })
    }

    const observer = newIntersectionObserver(
      handleIntersect,
      rootMargin || defaultRootMargin(windowHeight, triggerPosition),
    )
    setObserver(observer)

    return () => observer.disconnect()
  }, [vh])

  return (
    <ObserverContext.Provider value={observer}>
      {children}
    </ObserverContext.Provider>
  )
}

function newIntersectionObserver(
  handleIntersect: IntersectionObserverCallback,
  rootMargin: string,
) {
  return new IntersectionObserver(handleIntersect, {
    rootMargin,
    threshold: 0.000001,
  })
}

export function ObservedDiv({
  index,
  ...props
}: { index: number } & React.HTMLProps<HTMLDivElement>) {
  const ref = React.useRef<HTMLDivElement>(null)
  const observer = React.useContext(ObserverContext)

  useIsomorphicLayoutEffect(() => {
    if (observer && ref.current) {
      observer.observe(ref.current)
    }
    return () => {
      observer && ref.current && observer.unobserve(ref.current)
    }
  }, [observer])

  return <div ref={ref} {...props} data-index={index} />
}

function useWindowHeight(target: Element | null) {
  const isClient = typeof window === "object"

  function getHeight() {
    return isClient
      ? target?.clientHeight ?? document.documentElement.clientHeight
      : undefined
  }

  const [windowHeight, setWindowHeight] = React.useState(getHeight)

  React.useEffect(() => {
    function handleResize() {
      setWindowHeight(getHeight())
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useIsomorphicLayoutEffect(() => {
    // FIX when a horizontal scrollbar is added after the first layout
    setWindowHeight(getHeight())
  }, [])

  return windowHeight
}

type TriggerPosition = `${number}px` | `${number}%`

function defaultRootMargin(vh: number, triggerPosition = "50%") {
  let y = vh * 0.5

  if (triggerPosition.endsWith("%")) {
    const percent = parseFloat(triggerPosition.replace("%", ""))
    y = vh * (percent / 100)
  } else if (triggerPosition.endsWith("px")) {
    y = parseFloat(triggerPosition.replace("px", ""))
  }

  if (y < 0) {
    y = vh + y
  }

  const end = vh - y - 2

  const rootMargin = `-${y - 2}px 0px -${end < 0 ? 0 : end}px`

  return rootMargin
}
