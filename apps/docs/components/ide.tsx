import { ReactNode } from "react"

type IdeProps = {
  children: ReactNode
  copyButton?: ReactNode
}

export const IdeWindow = ({ children, copyButton }: IdeProps) => (
  <div className="relative flex-col">
    <div className="w-full h-11 bg-gray-100 flex justify-between items-center px-3 dark:bg-gray-800 border-b border-black/5">
      <div className="flex space-x-1.5">
        <span className="w-3 h-3 rounded-full bg-red-400"></span>
        <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
        <span className="w-3 h-3 rounded-full bg-green-400"></span>
      </div>
      {copyButton}
    </div>
    <div className="bg-gray-50 border-t-0 w-full flex dark:bg-gray-700">
      {children}
    </div>
  </div>
)
