import React from 'react';
import type { FunctionProps } from '../types';
import { formatParam, formatTsType } from '../utils';
import { parseMarkdown } from '../utils/jsdoc-links';

export const Function: React.FC<FunctionProps> = ({ functionDef, name, jsDoc }) => {
  const renderParams = () => {
    if (!functionDef.params || functionDef.params.length === 0) {
      return null;
    }

    return (
      <div className="my-4">
        <h4 className="font-semibold mb-2">Parameters</h4>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {functionDef.params.map((param, index) => {
              const paramTag = jsDoc?.tags?.find(
                (tag) => tag.kind === 'param' && tag.name === formatParam(param)
              );
              return (
                <tr key={index}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                    {formatParam(param)}
                    {param.optional && '?'}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-600">
                    {param.tsType ? formatTsType(param.tsType) : 'any'}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {paramTag?.doc && (
                      <div dangerouslySetInnerHTML={{ __html: parseMarkdown(paramTag.doc) }} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderReturnType = () => {
    if (!functionDef.returnType) return null;

    const returnTag = jsDoc?.tags?.find(
      (tag) => tag.kind === 'return' || tag.kind === 'returns'
    );

    return (
      <div className="my-4">
        <h4 className="font-semibold mb-2">Returns</h4>
        <div className="pl-4">
          <code className="bg-gray-100 px-2 py-1 rounded">
            {formatTsType(functionDef.returnType)}
          </code>
          {returnTag?.doc && (
            <div 
              className="mt-2 text-sm text-gray-700"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(returnTag.doc) }}
            />
          )}
        </div>
      </div>
    );
  };

  const renderSignature = () => {
    const asyncStr = functionDef.isAsync ? 'async ' : '';
    const generatorStr = functionDef.isGenerator ? '*' : '';
    const typeParams = functionDef.typeParams && functionDef.typeParams.length > 0
      ? `<${functionDef.typeParams.map(tp => tp.name).join(', ')}>`
      : '';
    const params = functionDef.params.map(formatParam).join(', ');
    const returnType = functionDef.returnType ? `: ${formatTsType(functionDef.returnType)}` : '';

    return (
      <pre className="bg-gray-100 p-3 rounded overflow-x-auto my-4">
        <code>
          {asyncStr}function{generatorStr} {name}{typeParams}({params}){returnType}
        </code>
      </pre>
    );
  };

  return (
    <div className="function-definition">
      {name && <h3 className="text-lg font-bold mb-2">{name}</h3>}
      
      {jsDoc?.doc && (
        <div 
          className="prose mb-4"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(jsDoc.doc) }}
        />
      )}

      {renderSignature()}
      {renderParams()}
      {renderReturnType()}

      {jsDoc?.tags?.filter(tag => tag.kind === 'example').map((tag, index) => (
        <div key={index} className="my-4">
          <h4 className="font-semibold mb-2">Example</h4>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
            <code>{tag.doc}</code>
          </pre>
        </div>
      ))}
    </div>
  );
};