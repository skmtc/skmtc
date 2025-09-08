import React from 'react';
import { Anchor } from './Anchor';
import { Deprecated } from './Deprecated';
import { SymbolContent } from './SymbolContent';

interface FunctionItem {
  id: string;
  anchor: {
    id: string;
  };
  name: string;
  summary: string;
  deprecated?: string | null;
  content: any;
}

interface FunctionProps {
  functions: FunctionItem[];
}

export const Function: React.FC<FunctionProps> = ({ functions }) => {
  return (
    <div className="mt-3 space-y-8">
      {functions.map((func, index) => (
        <React.Fragment key={func.id}>
          <div className="scroll-mt-16" id={func.id}>
            <code className="anchorable text-base break-words">
              <Anchor id={func.anchor.id} />
              <span className="font-bold">{func.name}</span>
              <span 
                className="font-medium"
                dangerouslySetInnerHTML={{ __html: func.summary }}
              />
            </code>

            <Deprecated content={func.deprecated || null} />

            <SymbolContent content={func.content} />
          </div>
          
          {index < functions.length - 1 && (
            <div className="border-b border-gray-300 max-w-[75ch] dark:border-gray-700"></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};