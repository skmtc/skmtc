import React from 'react'
import { HtmlHead } from './HtmlHead'
import { CategoryPanel } from './CategoryPanel'
import { TopNav } from './TopNav'
import { SearchResults } from './SearchResults'
import { Usages } from './Usages'
import { UsagesLarge } from './UsagesLarge'
import { ModuleDoc } from './ModuleDoc'
import { SymbolContent } from './SymbolContent'
import { Toc } from './Toc'

interface IndexPageProps {
  htmlHeadCtx: any
  categoriesPanel?: any
  breadcrumbsCtx?: any
  usage?: any
  moduleDoc?: any
  overview?: any
  tocCtx?: any
}

export const IndexPage: React.FC<IndexPageProps> = ({
  htmlHeadCtx,
  categoriesPanel,
  breadcrumbsCtx,
  usage,
  moduleDoc,
  overview,
  tocCtx
}) => {
  return (
    <html
      lang="en"
      className="inter_5972bc34-module__OU16Qa__className light"
      style={{ 'color-scheme': 'light' }}
    >
      <HtmlHead {...htmlHeadCtx} />
      <body>
        <div className="ddoc">
          <CategoryPanel {...categoriesPanel} />
          <div>
            <TopNav breadcrumbsCtx={breadcrumbsCtx} />
            <SearchResults />

            <div id="content">
              <main>
                {usage && <UsagesLarge usages={usage.usages || [usage]} />}
                {moduleDoc && <ModuleDoc {...moduleDoc} />}
                {overview && <SymbolContent {...overview} />}
              </main>

              <Toc {...tocCtx} />
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
