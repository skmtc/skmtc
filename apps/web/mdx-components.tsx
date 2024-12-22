import type { MDXComponents } from 'mdx/types'
import { Code } from './components/ui/code'
import { CodeWithTabs } from '@/components/ui/code-with-tabs'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    Code,
    CodeWithTabs
  }
}
