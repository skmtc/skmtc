import "./global.css"
import { RootProvider } from "fumadocs-ui/provider"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import type { ReactNode } from "react"
import { DocsLayout } from "fumadocs-ui/layout"
import { docsOptions } from "./layout.config"

type LayoutProps = {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <html
      lang="en"
      className={`${GeistMono.variable} ${GeistSans.variable}`}
      suppressHydrationWarning
    >
      <body>
        <RootProvider>
          <DocsLayout {...docsOptions}>{children}</DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}

export default Layout
