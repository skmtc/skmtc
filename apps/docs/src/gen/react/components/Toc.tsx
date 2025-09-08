import React from 'react'
import { ArrowIcon } from './Icon'
import { DocNodeKindIcon } from './DocNodeKindIcon'
import { Usages } from './Usages'

interface TopSymbol {
  name: string
  href: string
  kind: Array<{
    kind: string
    title: string
    char: string
  }>
}

interface TopSymbols {
  symbols: TopSymbol[]
  totalSymbols: number
  allSymbolsHref: string
}

interface TocProps {
  usages?: any
  topSymbols?: TopSymbols
  documentNavigationStr?: string
}

export const Toc: React.FC<TocProps> = ({ usages, topSymbols, documentNavigationStr }) => {
  const hasContent = usages || topSymbols || documentNavigationStr

  if (!hasContent) {
    return null
  }

  console.log('TOP SYMBOLS', topSymbols)

  return (
    <div className="toc">
      <div>
        {usages && <Usages {...usages} />}

        {topSymbols && (
          <nav className="topSymbols">
            <h3>Symbols</h3>
            <ul>
              {topSymbols.symbols.map((symbol, index) => (
                <li key={index}>
                  <a href={symbol.href} title={symbol.name}>
                    <DocNodeKindIcon kinds={symbol.kind} />
                    <span
                      className={`hover:bg-${symbol.kind[0]?.kind}/15 hover:bg-${symbol.kind[0]?.kind}Dark/15`}
                    >
                      {symbol.name}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            {topSymbols.totalSymbols > 5 && (
              <a className="flex items-center gap-0.5" href={topSymbols.allSymbolsHref}>
                <span className="leading-none">view all {topSymbols.totalSymbols} symbols</span>
                <ArrowIcon />
              </a>
            )}
          </nav>
        )}

        {documentNavigationStr && (
          <nav className="documentNavigation">
            <h3>Document Navigation</h3>
            <div dangerouslySetInnerHTML={{ __html: documentNavigationStr }} />
          </nav>
        )}
      </div>
    </div>
  )
}
