import React from 'react';
import { Deprecated } from './Deprecated';
import { SymbolContent } from './SymbolContent';

interface ModuleDocProps {
  deprecated?: string | null;
  sections?: any;
}

export const ModuleDoc: React.FC<ModuleDocProps> = ({ deprecated, sections }) => {
  return (
    <section>
      <div className="space-y-2 flex-1">
        <Deprecated content={deprecated || null} />
        <SymbolContent {...sections} />
      </div>
    </section>
  );
};