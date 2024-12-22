import type { DocsLayoutProps } from "fumadocs-ui/layout"
import { pageTree } from "@/app/source"

// docs layout configuration
export const docsOptions: DocsLayoutProps = {
  nav: {
    title: "CodeSquared docs",
  },
  tree: pageTree,
}
