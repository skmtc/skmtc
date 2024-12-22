import { ChevronRight, File, Folder } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub
} from '@/components/ui/sidebar'
import { useArtifacts } from '@/components/artifacts/artifacts-context'
import { useEffect, useState } from 'react'
import { set } from 'lodash'

type TreeItem = {
  [key: string]: string | TreeItem
}

const ArtifactsSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const { state, dispatch } = useArtifacts()

  const { artifacts } = state
  const [tree, setTree] = useState<TreeItem>({})

  useEffect(() => {
    const initialTree: TreeItem = {}

    const [path, value] = Object.entries(artifacts ?? {}).pop() ?? ['', '']

    dispatch({
      type: 'set-selected-artifact',
      payload: {
        value: value,
        lang: 'js',
        meta: path
      }
    })

    Object.entries(artifacts).forEach(([path, value]) => {
      set(initialTree, path.split('/'), value)
    })

    setTree(initialTree)
  }, [artifacts])

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {Object.entries(tree).map(([path, value]) => (
                <Tree key={path} path={path} value={value} parentPath={[path]} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default ArtifactsSidebar

type TreeProps = {
  path: string
  value: string | TreeItem
  parentPath: string[]
}

const Tree = ({ path, value, parentPath }: TreeProps) => {
  const { dispatch, state } = useArtifacts()
  const { selectedArtifact } = state

  if (typeof value === 'string') {
    return (
      <SidebarMenuButton
        isActive={selectedArtifact.meta === parentPath.join('/')}
        className="data-[active=true]:bg-transparent"
        onClick={() => {
          dispatch({
            type: 'set-selected-artifact',
            payload: {
              value: value,
              lang: 'js',
              meta: parentPath.join('/')
            }
          })
        }}
      >
        <File />
        {path}
      </SidebarMenuButton>
    )
  }

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        defaultOpen={true}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="transition-transform" />
            <Folder />
            {path}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {Object.entries(value).map(([path, value]) => (
              <Tree key={path} path={path} value={value} parentPath={[...parentPath, path]} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}
