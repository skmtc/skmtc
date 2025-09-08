import React from 'react';
import { ArrowIcon } from './Icon';

interface Category {
  name: string;
  href: string;
  active?: boolean;
}

interface CategoryPanelProps {
  categories: Category[];
  allSymbolsHref: string;
  totalSymbols: number;
}

export const CategoryPanel: React.FC<CategoryPanelProps> = ({ 
  categories, 
  allSymbolsHref, 
  totalSymbols 
}) => {
  if (!categories?.length) {
    return null;
  }

  return (
    <div id="categoryPanel">
      <ul>
        {categories.map((category, index) => (
          <li key={index} className={category.active ? 'active' : undefined}>
            <a href={category.href} title={category.name}>
              {category.name}
            </a>
          </li>
        ))}

        <li>
          <a className="!flex items-center gap-0.5" href={allSymbolsHref}>
            <span className="leading-none">
              view all {totalSymbols} symbols
            </span>
            <ArrowIcon />
          </a>
        </li>
      </ul>
    </div>
  );
};