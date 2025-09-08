import React from 'react'
import { DocsJson } from './types'
import { IndexPage } from './components/IndexPage'
import { SymbolPage } from './components/SymbolPage'

interface DocsAppProps {
  docsData: DocsJson
  pageType?: 'index' | 'symbol'
  pageConfig?: {
    title?: string
    currentFile?: string
    stylesheetUrl?: string
    pageStylesheetUrl?: string
    resetStylesheetUrl?: string
    scriptJs?: string
    darkmodeToggleJs?: string
    disableSearch?: boolean
    urlSearchIndex?: string
    fuseJs?: string
    searchJs?: string
  }
  categories?: Array<{
    name: string
    href: string
    active?: boolean
  }>
  allSymbolsHref?: string
  totalSymbols?: number
  breadcrumbs?: Array<{
    name: string
    href?: string
    isFirstSymbol?: boolean
    isSymbol?: boolean
  }>
  slug?: string[]
  usage?: any
  overview?: any
  symbolName?: string
}

export const DocsApp: React.FC<DocsAppProps> = ({
  slug,
  docsData,
  pageType = 'index',
  pageConfig = {},
  categories = [],
  allSymbolsHref = '',
  totalSymbols = 0,
  breadcrumbs = [],
  usage,
  overview,
  symbolName
}) => {
  // Transform DocsJson data for rendering
  const processDocsData = () => {
    // Extract module-level documentation
    const moduleDoc = docsData.nodes.find(node => node.kind === 'moduleDoc')

    // Extract symbols by type
    const functions = docsData.nodes.filter(node => node.kind === 'function')
    const classes = docsData.nodes.filter(node => node.kind === 'class')
    const interfaces = docsData.nodes.filter(node => node.kind === 'interface')
    const typeAliases = docsData.nodes.filter(node => node.kind === 'typeAlias')
    const variables = docsData.nodes.filter(node => node.kind === 'variable')
    const enums = docsData.nodes.filter(node => node.kind === 'enum')
    const namespaces = docsData.nodes.filter(node => node.kind === 'namespace')

    return {
      moduleDoc,
      functions,
      classes,
      interfaces,
      typeAliases,
      variables,
      enums,
      namespaces
    }
  }

  const processedData = processDocsData()

  // Build common context objects
  const htmlHeadCtx = {
    title: pageConfig.title || 'Documentation',
    currentFile: pageConfig.currentFile,
    stylesheetUrl: pageConfig.stylesheetUrl,
    pageStylesheetUrl: pageConfig.pageStylesheetUrl,
    resetStylesheetUrl: pageConfig.resetStylesheetUrl,
    scriptJs: pageConfig.scriptJs,
    darkmodeToggleJs: pageConfig.darkmodeToggleJs,
    disableSearch: pageConfig.disableSearch,
    urlSearchIndex: pageConfig.urlSearchIndex,
    fuseJs: pageConfig.fuseJs,
    searchJs: pageConfig.searchJs
  }

  const categoriesPanel =
    categories.length > 0
      ? {
          categories,
          allSymbolsHref,
          totalSymbols
        }
      : null

  const breadcrumbsCtx =
    breadcrumbs.length > 0
      ? {
          parts: breadcrumbs
        }
      : null

  // Build top symbols for TOC
  const topSymbols = {
    symbols: [
      ...processedData.functions.slice(0, 5).map(fn => ({
        name: fn.name,
        href: fn.name,
        kind: [{ kind: 'function', title: 'Function', char: 'F' }]
      })),
      ...processedData.classes.slice(0, 5 - processedData.functions.length).map(cls => ({
        name: cls.name,
        href: cls.name,
        kind: [{ kind: 'class', title: 'Class', char: 'C' }]
      }))
    ],
    totalSymbols: docsData.nodes.length - (processedData.moduleDoc ? 1 : 0),
    allSymbolsHref: allSymbolsHref || ''
  }

  const tocCtx = {
    usages: usage,
    topSymbols: topSymbols.symbols.length > 0 ? topSymbols : null
  }

  // Determine page type and content based on slug
  if (slug && slug.length > 0) {
    // Join the slug array and clean it
    const cleanSlug = slug.join('/').replace(/^\/+/, '')

    // If cleanSlug is empty after cleaning, treat as index page
    if (cleanSlug !== '') {
      // Find the symbol by name (slug should match symbol name)
      const symbol = docsData.nodes.find(
        node => node.name === cleanSlug || node.name.toLowerCase() === cleanSlug.toLowerCase()
      )

      if (symbol) {
        const symbolGroupCtx = {
          name: symbol.name,
          symbols: [
            {
              kind: {
                kind: symbol.kind,
                titleLowercase: symbol.kind.toLowerCase()
              },
              tags: [], // Would need to extract from jsDoc or other metadata
              content: [
                {
                  kind: 'symbolContent',
                  value: {
                    docs: symbol.jsDoc?.doc,
                    // Would need to transform the symbol's definition to sections
                    sections: []
                  }
                }
              ]
            }
          ],
          usage
        }

        return (
          <SymbolPage
            htmlHeadCtx={htmlHeadCtx}
            categoriesPanel={categoriesPanel}
            breadcrumbsCtx={breadcrumbsCtx}
            symbolGroupCtx={symbolGroupCtx}
            tocCtx={tocCtx}
          />
        )
      }
    }
  }

  // Fallback: if pageType is explicitly set to symbol and symbolName is provided
  if (pageType === 'symbol' && symbolName) {
    const symbol = docsData.nodes.find(node => node.name === symbolName)

    if (symbol) {
      const symbolGroupCtx = {
        name: symbolName,
        symbols: [
          {
            kind: {
              kind: symbol.kind,
              titleLowercase: symbol.kind.toLowerCase()
            },
            tags: [], // Would need to extract from jsDoc or other metadata
            content: [
              {
                kind: 'symbolContent',
                value: {
                  docs: symbol.jsDoc?.doc,
                  // Would need to transform the symbol's definition to sections
                  sections: []
                }
              }
            ]
          }
        ],
        usage
      }

      return (
        <SymbolPage
          htmlHeadCtx={htmlHeadCtx}
          categoriesPanel={categoriesPanel}
          breadcrumbsCtx={breadcrumbsCtx}
          symbolGroupCtx={symbolGroupCtx}
          tocCtx={tocCtx}
        />
      )
    }
  }

  // Default to index page
  const moduleDocData = processedData.moduleDoc
    ? {
        deprecated: processedData.moduleDoc.jsDoc?.tags?.find(tag => tag.kind === 'deprecated')
          ?.doc,
        sections: {
          docs: processedData.moduleDoc.jsDoc?.doc,
          sections: [] // Would need to build sections from the module doc
        }
      }
    : null

  return (
    <IndexPage
      htmlHeadCtx={htmlHeadCtx}
      categoriesPanel={categoriesPanel}
      breadcrumbsCtx={breadcrumbsCtx}
      usage={usage}
      moduleDoc={moduleDocData}
      overview={overview}
      tocCtx={tocCtx}
    />
  )
}
