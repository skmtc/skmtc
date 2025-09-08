import React from 'react';

interface DeprecatedProps {
  content: string | null;
}

export const Deprecated: React.FC<DeprecatedProps> = ({ content }) => {
  if (content === null) {
    return null;
  }

  return (
    <div className="deprecated">
      <div>
        <span>Deprecated</span>
      </div>
      {content && content !== '' && (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      )}
    </div>
  );
};