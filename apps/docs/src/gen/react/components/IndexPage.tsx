import React from 'react';
import type { IndexPageProps } from '../types';
import { renderValue } from '../utils/index';
import { HtmlHead } from './HtmlHead';
import { CategoryPanel } from './CategoryPanel';
import { TopNav } from './TopNav';
import { UsagesLarge } from './UsagesLarge';
import { ModuleDoc } from './ModuleDoc';
import { SymbolContent } from './SymbolContent';
import { Toc } from './Toc';

export const IndexPage: React.FC<IndexPageProps> = ({
  usage,
  module_doc,
  overview,
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
            <main className="flex-1 max-w-4xl mx-auto px-4 py-8">
              {usage && <UsagesLarge usage={usage} />}
              {module_doc && <ModuleDoc {...module_doc} />}
              {overview && (
                <div className="overview-content">
                  <SymbolContent value={renderValue(overview)} />
                </div>
              )}
            </main>

            {toc_ctx && <Toc {...toc_ctx} />}
          </div>
        </div>
      </div>
    </>
  );
};