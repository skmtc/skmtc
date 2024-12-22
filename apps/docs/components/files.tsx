"use client"

import { cva } from "class-variance-authority"
import { FileIcon, FolderIcon, FolderOpen } from "lucide-react"
import type { HTMLAttributes, ReactNode } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible"
import { cn } from "@/lib/utils"

const item = cva(
  "flex flex-row items-center gap-2 rounded-md px-2 py-1.5 text-sm [&_svg]:size-4",
)

export function Files({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn(
        "not-prose p-2 font-mono hidden xl:block border-r border-black/5 dark:bg-gray-800",
        className,
      )}
      {...props}
    >
      {props.children}
    </div>
  )
}

export interface FileProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  icon?: ReactNode
}

export interface FolderProps extends HTMLAttributes<HTMLDivElement> {
  name: string

  disabled?: boolean

  /**
   * Open folder by default
   *
   * @defaultValue false
   */
  open?: boolean
}

export function File({
  name,
  icon = <FileIcon />,
  className,
  ...rest
}: FileProps): React.ReactElement {
  return (
    <div className={cn(item({ className }))} {...rest}>
      {icon}
      {name}
    </div>
  )
}

export function Folder({
  name,
  open = false,
  ...props
}: FolderProps): React.ReactElement {
  // const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} /* onOpenChange={setOpen}*/ {...props}>
      <CollapsibleTrigger
        className={cn(item({ className: "w-full whitespace-nowrap" }))}
      >
        {open ? <FolderOpen /> : <FolderIcon />}
        {name}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ms-2 flex flex-col pl-2">{props.children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
