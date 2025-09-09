import React from 'react';
import type { SymbolPageProps } from '../types';
import { HtmlHead } from './HtmlHead';
import { CategoryPanel } from './CategoryPanel';
import { TopNav } from './TopNav';
import { SymbolGroup } from './SymbolGroup';
import { Toc } from './Toc';

export const SymbolPage: React.FC<SymbolPageProps> = ({
  symbol_group_ctx,
  html_head_ctx,
  categories_panel,
  toc_ctx,
}) => {
  return (
    <>
      <HtmlHead {...html_head_ctx} />
      <div className="flex min-h-screen">
        <CategoryPanel {...categories_panel} />
        <div className="flex-1 flex flex-col">
          <TopNav />
          
          <div id="content" className="flex flex-1">
            <SymbolGroup {...symbol_group_ctx} />
            {toc_ctx && <Toc {...toc_ctx} />}
          </div>
        </div>
      </div>
    </>
  );
};