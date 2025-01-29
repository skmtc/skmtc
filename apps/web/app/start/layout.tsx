'use server'

import Section from '@/app/start/section'
import { toFileTree, toFlatFileTree } from '@/lib/toFileTree'
import fileTree from '@/app/reapit-files.json'
import downloadFileTree from '@/app/reapit-download.json'

type LayoutProps = {
  children: React.ReactNode
}

const Layout = ({ children, ...props }: LayoutProps) => {
  const scrubbedDownloadFileTree = Object.entries(downloadFileTree).map(([key, value]) => {
    return [key.replace('app/reapit-download/', ''), value]
  })

  return (
    <Section fileNodes={fileTree} downloadFileTree={Object.fromEntries(scrubbedDownloadFileTree)}>
      {children}
    </Section>
  )
}

export default Layout
