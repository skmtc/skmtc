import React from 'react';
import type { ModuleDocProps } from '../types';
import { parseMarkdown } from '../utils/jsdoc-links';
import { Example } from './Example';

export const ModuleDoc: React.FC<ModuleDocProps> = ({ doc, examples }) => {
  if (!doc && (!examples || examples.length === 0)) {
    return null;
  }

  return (
    <div className="module-doc my-6">
      {doc && (
        <div 
          className="prose max-w-none mb-6"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(doc) }}
        />
      )}
      
      {examples && examples.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Examples</h3>
          {examples.map((example) => (
            <Example key={example.id} example={example} />
          ))}
        </div>
      )}
    </div>
  );
};