import React from 'react';
import type { JsDocTag } from '../types';

interface TagProps {
  value: JsDocTag | string;
  large?: boolean;
}

export const Tag: React.FC<TagProps> = ({ value, large = false }) => {
  // Handle both JsDocTag objects and strings
  const tagData = typeof value === 'string' 
    ? { kind: value, value: undefined }
    : { kind: value.kind, value: value.doc };
  
  const sizeClasses = large 
    ? 'font-bold py-2 px-3' 
    : 'text-sm py-1 px-2';
  
  const kindColorMap: Record<string, string> = {
    deprecated: 'yellow',
    experimental: 'orange', 
    internal: 'red',
    since: 'green',
    see: 'purple',
    example: 'indigo',
    param: 'gray',
    return: 'gray',
    returns: 'gray',
    throws: 'red',
    author: 'blue',
    version: 'green',
    template: 'purple',
    unsupported: 'red',
    module: 'blue'
  };
  
  const colorClass = kindColorMap[tagData.kind] || 'gray';
  
  const titleCase = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  
  const renderContent = () => {
    if (large) {
      if (tagData.value) {
        return titleCase(tagData.value);
      }
      return titleCase(tagData.kind);
    } else {
      return tagData.value || tagData.kind;
    }
  };
  
  return (
    <div className={`text-${colorClass}-700 border border-${colorClass}-500/50 bg-${colorClass}-500/5 inline-flex items-center gap-0.5 rounded-md leading-none ${sizeClasses}`}>
      {renderContent()}
    </div>
  );
};