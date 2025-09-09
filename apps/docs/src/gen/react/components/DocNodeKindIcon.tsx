import React from 'react';
import type { DocNodeKindIconProps } from '../types';
import { getKindColor } from '../utils';

export const DocNodeKindIcon: React.FC<DocNodeKindIconProps> = ({ kind }) => {
  const iconMap = {
    moduleDoc: 'M',
    variable: 'V',
    typeAlias: 'T',
    function: 'F',
    class: 'C',
    interface: 'I',
    namespace: 'N',
    enum: 'E',
    import: '↓',
    export: '↑',
  };

  const icon = iconMap[kind] || '?';
  const color = getKindColor(kind);

  return (
    <span className={`inline-block w-6 h-6 text-center font-mono font-bold ${color}`}>
      {icon}
    </span>
  );
};