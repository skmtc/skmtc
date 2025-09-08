import React from 'react';

interface TagValue {
  kind: string;
  value?: string | string[];
}

interface TagProps {
  value: TagValue;
  large?: boolean;
}

const titleCase = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const Tag: React.FC<TagProps> = ({ value, large = false }) => {
  const renderContent = () => {
    if (large) {
      if (value.value) {
        if (value.kind === 'permissions' && Array.isArray(value.value)) {
          return (
            <span className="space-x-2">
              {value.value.map((item, index) => (
                <React.Fragment key={index}>
                  <span>{item}</span>
                  {index < value.value!.length - 1 && (
                    <div className="inline border-l-2 border-stone-300 dark:border-gray-700"></div>
                  )}
                </React.Fragment>
              ))}
            </span>
          );
        }
        return titleCase(Array.isArray(value.value) ? value.value.join(', ') : value.value);
      }
      return titleCase(value.kind);
    } else {
      if (value.value) {
        return Array.isArray(value.value) ? value.value.join(', ') : value.value;
      }
      return value.kind;
    }
  };

  const sizeClasses = large ? 'font-bold py-2 px-3' : 'text-sm py-1 px-2';

  return (
    <div
      className={`text-${value.kind} border border-${value.kind}/50 bg-${value.kind}/5 inline-flex items-center gap-0.5 *:flex-none rounded-md leading-none ${sizeClasses}`}
    >
      {renderContent()}
    </div>
  );
};