import React from 'react';

interface Usage {
  content: string;
}

interface UsagesLargeProps {
  usages: Usage[];
}

export const UsagesLarge: React.FC<UsagesLargeProps> = ({ usages }) => {
  if (!usages || usages.length === 0) {
    return null;
  }

  return (
    <div className="usageContent px-4 pt-4 pb-5 bg-stone-100 rounded border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
      <h3>Usage in Deno</h3>
      <div dangerouslySetInnerHTML={{ __html: usages[0]?.content || '' }} />
    </div>
  );
};