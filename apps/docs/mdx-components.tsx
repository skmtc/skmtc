import type { MDXComponents } from "mdx/types"
import defaultComponents from "fumadocs-ui/mdx"
import { Code } from "@/components/ui/code"
import { Scrollycoding } from "@/components/scrollycoding"
import { HoverContainer } from "@/components/ui/hover-container"
import { HoverLink } from "@/components/ui/hover-link"
import { Intro } from "@/components/ui/intro"
import { CodeWithTabs } from "@/components/code-with-tabs"

export const useMDXComponents = (components: MDXComponents): MDXComponents => {
  return {
    ...defaultComponents,
    ...components,
    HoverContainer,
    Intro,
    a: HoverLink,
    Scrollycoding,
    CodeWithTabs,
    Code,
  }
}
