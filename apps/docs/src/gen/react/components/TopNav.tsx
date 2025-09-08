import React from 'react';
import { MoonIcon, SunIcon } from './Icon';
import { Breadcrumbs } from './Breadcrumbs';

interface TopNavProps {
  breadcrumbsCtx?: any;
  disableSearch?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({ breadcrumbsCtx, disableSearch = false }) => {
  return (
    <nav id="topnav">
      <div className="h-full">
        <div className="flex items-center">
          {breadcrumbsCtx && <Breadcrumbs {...breadcrumbsCtx} />}
        </div>

        <div className="flex items-center gap-2">
          <button 
            id="theme-toggle" 
            type="button" 
            aria-label="Toggle dark mode" 
            style={{ display: 'none' }}
          >
            <MoonIcon />
            <SunIcon className="hidden" />
          </button>

          {!disableSearch && (
            <input
              type="text"
              id="searchbar"
              style={{ display: 'none' }}
              className="py-2 px-2.5 mx-1 rounded text-sm border border-gray-300 bg-transparent dark:bg-gray-800 dark:border-gray-700"
            />
          )}
        </div>
      </div>
    </nav>
  );
};