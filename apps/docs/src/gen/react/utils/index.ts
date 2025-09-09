import React from 'react';
import type { NodeKind, TsType, Param } from '../types';

export function getKindColor(kind: NodeKind): string {
  const colorMap: Record<NodeKind, string> = {
    moduleDoc: 'text-blue-600',
    variable: 'text-green-600',
    typeAlias: 'text-purple-600',
    function: 'text-yellow-600',
    class: 'text-red-600',
    interface: 'text-cyan-600',
    namespace: 'text-indigo-600',
    enum: 'text-orange-600',
    import: 'text-gray-600',
    export: 'text-gray-600',
  };
  return colorMap[kind] || 'text-gray-600';
}

export function formatTsType(tsType: TsType): string {
  return tsType.repr;
}

export function formatParam(param: Param): string {
  if (!param) return '';
  
  switch (param.kind) {
    case 'identifier':
      return param.name || '';
    case 'array':
      return `[${param.elements?.map(formatParam).join(', ') || ''}]`;
    case 'object':
      return `{${param.props?.map(formatParam).join(', ') || ''}}`;
    case 'rest':
      return `...${param.arg ? formatParam(param.arg) : ''}`;
    case 'assign':
      return `${param.left ? formatParam(param.left) : ''} = ${param.right || ''}`;
    case 'keyValue':
      return `${param.key}: ${param.value ? formatParam(param.value) : ''}`;
    default:
      return '';
  }
}

export function getKindTitle(kind: NodeKind): string {
  const titleMap: Record<NodeKind, string> = {
    moduleDoc: 'Module',
    variable: 'Variable',
    typeAlias: 'Type Alias',
    function: 'Function',
    class: 'Class',
    interface: 'Interface',
    namespace: 'Namespace',
    enum: 'Enum',
    import: 'Import',
    export: 'Export',
  };
  return titleMap[kind] || kind;
}

export function getKindTitleLowercase(kind: NodeKind): string {
  return getKindTitle(kind).toLowerCase();
}

export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, '_');
}

export function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (React.isValidElement(value)) {
    return value;
  }
  
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  
  return String(value);
}

export function isReactNode(value: unknown): value is React.ReactNode {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    React.isValidElement(value) ||
    (Array.isArray(value) && value.every(isReactNode))
  );
}