import React from 'react';
import { Tag } from './Tag';
import { SourceButton } from './SourceButton';
import { Usages } from './Usages';
import { UsagesLarge } from './UsagesLarge';
import { Deprecated } from './Deprecated';
import { Function } from './Function';
import { SymbolContent } from './SymbolContent';

interface SymbolKind {
  kind: string;
  titleLowercase: string;
}

interface SymbolContentItem {
  kind: string;
  value: any;
}

interface Symbol {
  kind: SymbolKind;
  subtitle?: {
    kind: string;
    value: any;
  };
  tags?: Array<{ kind: string; value?: string | string[] }>;
  sourceHref?: string;
  deprecated?: string | null;
  content: SymbolContentItem[];
}

interface SymbolGroupProps {
  name: string;
  symbols: Symbol[];
  usage?: any;
}

export const SymbolGroup: React.FC<SymbolGroupProps> = ({ name, symbols, usage }) => {
  const renderSubtitle = (subtitle: { kind: string; value: any }) => {
    // This would need dynamic component rendering based on subtitle.kind
    // For now, render as generic content
    return <div>Subtitle: {JSON.stringify(subtitle)}</div>;
  };

  const renderContent = (contentItems: SymbolContentItem[]) => {
    return contentItems.map((item, index) => {
      if (item.kind === 'function') {
        return <Function key={index} {...item.value} />;
      }
      return <SymbolContent key={index} {...item.value} />;
    });
  };

  return (
    <main className="symbolGroup" id={`symbol_${name}`}>
      {symbols.map((symbol, symbolIndex) => (
        <article key={symbolIndex}>
          <div className="symbolTitle">
            <div>
              <div className="text-2xl leading-none break-all">
                <span className={`text-${symbol.kind.kind}`}>
                  {symbol.kind.titleLowercase}
                </span>
                &nbsp;
                <span className="font-bold">{name}</span>
              </div>
              
              {symbol.subtitle && (
                <div className="symbolSubtitle">
                  {renderSubtitle(symbol.subtitle)}
                </div>
              )}
              
              {symbol.tags && (
                <div className="space-x-2 !mt-2">
                  {symbol.tags.map((tag, tagIndex) => (
                    <Tag key={tagIndex} value={tag} large />
                  ))}
                </div>
              )}
            </div>

            {symbol.sourceHref && <SourceButton href={symbol.sourceHref} />}
          </div>

          {usage && symbolIndex === 0 && <UsagesLarge usages={usage.usages || [usage]} />}

          <Deprecated content={symbol.deprecated || null} />

          <div>
            {renderContent(symbol.content)}
          </div>
        </article>
      ))}
    </main>
  );
};