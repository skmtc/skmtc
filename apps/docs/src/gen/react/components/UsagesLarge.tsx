import React from 'react';
import type { UsageInfo } from '../types';
import { Example } from './Example';

interface UsagesLargeProps {
  usage: UsageInfo;
}

export const UsagesLarge: React.FC<UsagesLargeProps> = ({ usage }) => {
  if (!usage) return null;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-6 my-6">
      <h3 className="text-lg font-semibold mb-4">Usage</h3>
      
      {usage.entrypoints && usage.entrypoints.length > 0 && (
        <div className="mb-4">
          <span className="font-semibold">Import from: </span>
          {usage.entrypoints.map((entrypoint, index) => (
            <React.Fragment key={entrypoint}>
              {index > 0 && ', '}
              <code className="bg-white px-2 py-1 rounded border border-blue-200">
                {entrypoint}
              </code>
            </React.Fragment>
          ))}
        </div>
      )}
      
      {usage.code && (
        <div className="mb-4">
          <pre className="bg-white p-4 rounded border border-blue-200 overflow-x-auto">
            <code>{usage.code}</code>
          </pre>
        </div>
      )}
      
      {usage.examples && usage.examples.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Examples:</h4>
          {usage.examples.map((example) => (
            <Example key={example.id} example={example} />
          ))}
        </div>
      )}
    </div>
  );
};