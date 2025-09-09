import React from 'react';
import type { ExampleInfo } from '../types';

interface ExampleProps {
  example: ExampleInfo;
}

export const Example: React.FC<ExampleProps> = ({ example }) => {
  return (
    <div className="my-4 border rounded-lg overflow-hidden">
      {example.title && (
        <div className="bg-gray-100 px-4 py-2 border-b">
          <h4 className="font-semibold">{example.title}</h4>
        </div>
      )}
      {example.description && (
        <div className="px-4 py-2 bg-gray-50 border-b">
          <p className="text-sm text-gray-700">{example.description}</p>
        </div>
      )}
      <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto">
        <code>{example.code}</code>
      </pre>
    </div>
  );
};