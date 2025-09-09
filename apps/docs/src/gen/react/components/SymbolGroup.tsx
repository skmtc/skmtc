import React from 'react'
import type { SymbolGroupProps } from '../types'
import { getKindTitleLowercase } from '../utils'
import { SourceButton } from './SourceButton'
import { Tag } from './Tag'
import { Deprecated } from './Deprecated'
import { UsagesLarge } from './UsagesLarge'
import { Function } from './Function'
import { SymbolContent } from './SymbolContent'

export const SymbolGroup: React.FC<SymbolGroupProps> = ({ name, symbols }) => {
  return (
    <main className="symbolGroup" id={`symbol_${name}`}>
      {symbols.map((symbol, index) => {
        console.log('SYMBOL: ', symbol)
        return (
          <article key={index}>
            <div className="symbolTitle flex justify-between items-start mb-4">
              <div>
                <div className="text-2xl leading-none break-all">
                  <span className={`text-${symbol.kind.kind}`}>{symbol.kind.title_lowercase}</span>
                  &nbsp;
                  <span className="font-bold">{name}</span>
                </div>

                {symbol.subtitle && (
                  <div className="symbolSubtitle mt-2">
                    <SubtitleContent kind={symbol.subtitle.kind} value={symbol.subtitle.value} />
                  </div>
                )}

                {symbol.tags && symbol.tags.length > 0 && (
                  <div className="space-x-2 !mt-2">
                    {symbol.tags
                      .filter((tag: any) => ['deprecated', 'experimental', 'internal', 'since'].includes(tag.kind))
                      .map((tag: any, i: number) => {
                        console.log('TAG: ', tag)
                        return <Tag key={i} value={tag} large={true} />
                      })}
                  </div>
                )}
              </div>

              {symbol.source_href && <SourceButton href={symbol.source_href} />}
            </div>

            {symbol.usage && index === 0 && <UsagesLarge usage={symbol.usage} />}

            <Deprecated deprecated={symbol.deprecated} />

            <div>
              {symbol.content.map((contentItem, i) => (
                <div key={i}>
                  {contentItem.kind === 'function' ? (
                    <Function functionDef={contentItem.value as any} name={name} />
                  ) : (
                    <SymbolContent value={contentItem.value} />
                  )}
                </div>
              ))}
            </div>
          </article>
        )
      })}
    </main>
  )
}

const SubtitleContent: React.FC<{ kind: string; value: unknown }> = ({ kind, value }) => {
  switch (kind) {
    case 'class':
      return <ClassSubtitle value={value as any} />
    case 'interface':
      return <InterfaceSubtitle value={value as any} />
    default:
      return <div>{JSON.stringify(value)}</div>
  }
}

const ClassSubtitle: React.FC<{ value: any }> = ({ value }) => {
  if (!value) return null

  return (
    <div className="text-sm text-gray-600">
      {value.extends && (
        <span>
          extends <code>{value.extends}</code>
        </span>
      )}
      {value.implements && value.implements.length > 0 && (
        <span>
          {' '}
          implements <code>{value.implements.join(', ')}</code>
        </span>
      )}
    </div>
  )
}

const InterfaceSubtitle: React.FC<{ value: any }> = ({ value }) => {
  if (!value || !value.extends || value.extends.length === 0) return null

  return (
    <div className="text-sm text-gray-600">
      extends <code>{value.extends.join(', ')}</code>
    </div>
  )
}
