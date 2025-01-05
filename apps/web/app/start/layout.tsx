'use server'

import Section from '@/app/start/section'
import { toFileTree } from '@/lib/toFileTree'

type LayoutProps = {
  children: React.ReactNode
}

const Layout = ({ children, ...props }: LayoutProps) => {
  const fileTree = toFileTree('./app/reapit-files')

  return <Section fileNodes={fileTree}>{children}</Section>
}

export default Layout
