import React from 'react'
import { HtmlHead } from './HtmlHead'
import { CategoryPanel } from './CategoryPanel'
import { TopNav } from './TopNav'
import { SearchResults } from './SearchResults'
import { SymbolGroup } from './SymbolGroup'
import { Toc } from './Toc'

interface SymbolPageProps {
  htmlHeadCtx: any
  categoriesPanel?: any
  breadcrumbsCtx?: any
  symbolGroupCtx: any
  tocCtx?: any
}

export const SymbolPage: React.FC<SymbolPageProps> = ({
  htmlHeadCtx,
  categoriesPanel,
  breadcrumbsCtx,
  symbolGroupCtx,
  tocCtx
}) => {
  return (
    <html
      lang="en"
      className="inter_5972bc34-module__OU16Qa__className light"
      style={{ 'color-scheme': 'light' } as React.CSSProperties}
    >
      <HtmlHead {...htmlHeadCtx} />
      <body className="flex flex-col min-h-screen">
        <div className="ddoc">
          <CategoryPanel {...categoriesPanel} />
          <div>
            <TopNav breadcrumbsCtx={breadcrumbsCtx} />
            <SearchResults />

            <div id="content">
              <SymbolGroup {...symbolGroupCtx} />
              <Toc {...tocCtx} />
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
