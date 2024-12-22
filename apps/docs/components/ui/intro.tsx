import { ReactNode } from "react"

type IntroProps = {
  children: ReactNode
}

export const Intro = ({ children }: IntroProps) => (
  <div className="mt-20 mb-10 max-w-4xl">{children}</div>
)
