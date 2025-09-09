import React from 'react';
import type { UsageInfo } from '../types';

interface UsagesProps {
  usage: UsageInfo;
}

export const Usages: React.FC<UsagesProps> = ({ usage }) => {
  if (!usage) return null;

  return (
    <div className="my-4">
      {usage.entrypoints && usage.entrypoints.length > 0 && (
        <div className="mb-2">
          <span className="font-semibold">Import from: </span>
          <code className="bg-gray-100 px-2 py-1 rounded">
            {usage.entrypoints.join(', ')}
          </code>
        </div>
      )}
      {usage.code && (
        <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
          <code>{usage.code}</code>
        </pre>
      )}
    </div>
  );
};