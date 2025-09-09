import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { baseOptions } from '@/lib/layout.shared'
import { source } from '@/lib/source'
import docsData from '@/gen/docs.json'

const Layout = ({ children }: LayoutProps<'/docs'>) => {
  console.log('LAYOUT', source.pageTree)

  const tree = docsData.nodes.map(node => {
    return {
      name: node.name,
      url: `/docs/${node.name}`,
      type: 'page'
    }
  })

  return (
    <DocsLayout tree={{ children: tree }} {...baseOptions()}>
      {children}
    </DocsLayout>
  )
}

export default Layout
