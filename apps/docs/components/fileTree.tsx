import { Files, Folder, File } from "@/components/files"
import { CodeBlock } from "codehike/blocks"
import { match } from "ts-pattern"
import { z } from "zod"

const treeFile = z.object({
  type: z.literal("file"),
  name: z.string(),
})

type TreeFile = {
  type: "file"
  name: string
}

type TreeFolder = {
  type: "folder"
  name: string
  children: (TreeFile | TreeFolder)[]
}

const treeFolder: z.ZodType<TreeFolder> = z.object({
  type: z.literal("folder"),
  name: z.string(),
  children: z.lazy(() => z.array(z.union([treeFile, treeFolder]))),
})

const treeItems = z.array(z.union([treeFile, treeFolder]))

type TreeItems = (TreeFile | TreeFolder)[]

type FileTreeProps = {
  tree: z.infer<typeof CodeBlock> | undefined
  currentFilePath: string
}

export const FileTree = ({ tree, currentFilePath }: FileTreeProps) => {
  if (!tree) {
    return null
  }

  const treeItemObject = JSON.parse(tree.value)
  const parsedTreeItems = treeItems.parse(treeItemObject)

  return (
    <Files>
      {parsedTreeItems.map((treeItem) => (
        <FileTreeItem
          key={treeItem.name}
          treeItem={treeItem}
          parentName={"@"}
          currentFilePath={currentFilePath}
        />
      ))}
    </Files>
  )
}

type FileTreeItemProps = {
  parentName: string
  currentFilePath: string
  treeItem: TreeFile | TreeFolder
}

const FileTreeItem = ({
  parentName,
  currentFilePath,
  treeItem,
}: FileTreeItemProps) => {
  return match(treeItem)
    .with({ type: "file" }, ({ name }) => {
      const className = isSelected({ currentFilePath, parentName, name })
        ? "text-secondary-foreground"
        : "text-muted-foreground"

      return <File name={name} className={className} />
    })
    .with({ type: "folder" }, ({ name, children }) => {
      const newParentName = `${parentName}/${name}`
      const open = currentFilePath.startsWith(newParentName)

      return (
        <Folder name={name} open={open} className="text-muted-foreground">
          {children.map((child) => (
            <FileTreeItem
              key={child.name}
              parentName={newParentName}
              currentFilePath={currentFilePath}
              treeItem={child}
            />
          ))}
        </Folder>
      )
    })
    .exhaustive()
}

type IsSelectedProps = {
  currentFilePath: string
  name: string
  parentName: string
}

const isSelected = ({ currentFilePath, name, parentName }: IsSelectedProps) => {
  return currentFilePath === `${parentName}/${name}`
}
