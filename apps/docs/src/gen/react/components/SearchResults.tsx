import React from 'react';
import type { SearchResultsPageProps } from '../types';
import { DocNodeKindIcon } from './DocNodeKindIcon';
import { getKindTitle } from '../utils';

export const SearchResults: React.FC<SearchResultsPageProps> = ({ query, results }) => {
  if (!query) return null;

  return (
    <div className="search-results bg-white border rounded-lg p-6 my-6">
      <h2 className="text-2xl font-bold mb-4">
        Search Results for "{query}"
      </h2>
      
      {results.length === 0 ? (
        <p className="text-gray-600">No results found.</p>
      ) : (
        <>
          <p className="text-gray-600 mb-4">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0">
                <a
                  href={result.href}
                  className="group block hover:bg-gray-50 -mx-2 px-2 py-2 rounded"
                >
                  <div className="flex items-start">
                    <DocNodeKindIcon kind={result.kind} />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center">
                        <span className="font-semibold text-blue-600 group-hover:text-blue-800">
                          {result.name}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {getKindTitle(result.kind)}
                        </span>
                      </div>
                      {result.description && (
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};