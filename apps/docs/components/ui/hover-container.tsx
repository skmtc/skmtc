type HoverContainerProps = {
  children: React.ReactNode
}

export const HoverContainer = ({ children }: HoverContainerProps) => {
  return <div className="hover-container">{children}</div>
}
