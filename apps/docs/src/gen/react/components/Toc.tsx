import React from 'react';
import type { TocProps, TocItem } from '../types';
import { DocNodeKindIcon } from './DocNodeKindIcon';

export const Toc: React.FC<TocProps> = ({ items }) => {
  const renderTocItem = (item: TocItem, level: number = 0) => {
    const paddingClass = `pl-${level * 4}`;
    
    return (
      <li key={item.href} className="my-1">
        <a
          href={item.href}
          className={`flex items-center py-1 px-2 text-sm hover:bg-gray-100 rounded ${
            item.isActive ? 'bg-gray-100 font-semibold' : ''
          } ${paddingClass}`}
        >
          {item.kind && <DocNodeKindIcon kind={item.kind} />}
          <span className="ml-2">{item.name}</span>
        </a>
        {item.children && item.children.length > 0 && (
          <ul className="ml-2">
            {item.children.map((child) => renderTocItem(child, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className="toc sticky top-4 w-64 ml-8">
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-semibold text-lg mb-3">Table of Contents</h3>
        <ul className="space-y-1">
          {items.map((item) => renderTocItem(item))}
        </ul>
      </div>
    </nav>
  );
};