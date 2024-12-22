"use client"
import React from "react"
import { ObservedDiv, Scroller } from "./scroller"

const StepsContext = React.createContext<{
  selectedIndex: number
  selectIndex: React.Dispatch<React.SetStateAction<number>>
}>({
  selectedIndex: 0,
  selectIndex: () => {},
})

type SelectionProviderProps = {
  children: React.ReactNode
  rootMargin?: string
  root?: Element | null
} & React.HTMLAttributes<HTMLDivElement>

export function SelectionProvider({
  children,
  rootMargin,
  root = null,
  ...rest
}: SelectionProviderProps) {
  const [selectedIndex, selectIndex] = React.useState<number>(0)
  const parentRef = React.useRef<HTMLDivElement>(null)

  return (
    <div
      id="scroller-root"
      data-selected-index={selectedIndex}
      ref={parentRef}
      {...rest}
    >
      <Scroller
        onIndexChange={selectIndex}
        rootMargin={rootMargin}
        parentRef={parentRef}
      >
        <StepsContext.Provider
          value={{
            selectedIndex,
            selectIndex,
          }}
        >
          {children}
        </StepsContext.Provider>
      </Scroller>
    </div>
  )
}

export function Selectable({
  index,
  selectOn = ["click"],
  ...rest
}: {
  index: number
  selectOn?: ("click" | "hover" | "scroll")[]
} & React.HTMLAttributes<HTMLDivElement>) {
  const { selectedIndex, selectIndex } = React.useContext(StepsContext)
  const eventHandlers = React.useMemo(() => {
    const handlers: Record<string, () => void> = {}
    if (selectOn.includes("click")) {
      handlers.onClick = () => selectIndex(index)
    }
    if (selectOn.includes("hover")) {
      handlers.onMouseEnter = () => selectIndex(index)
    }
    return handlers
  }, [index, selectIndex, selectOn])

  const props = {
    "data-selected": selectedIndex === index,
    ...eventHandlers,
    ...rest,
  }

  return selectOn.includes("scroll") ? (
    <ObservedDiv index={index} {...props} />
  ) : (
    <div {...props} />
  )
}

export function Selection({ from }: { from: React.ReactNode[] }) {
  const { selectedIndex } = React.useContext(StepsContext)
  return from[selectedIndex]
}

export function useSelectedIndex() {
  const { selectedIndex, selectIndex } = React.useContext(StepsContext)
  return [selectedIndex, selectIndex] as const
}
