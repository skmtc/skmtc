import React from 'react';

interface KindItem {
  kind: string;
  title: string;
  char: string;
}

interface DocNodeKindIconProps {
  kinds: KindItem[];
}

export const DocNodeKindIcon: React.FC<DocNodeKindIconProps> = ({ kinds }) => {
  return (
    <div className="docNodeKindIcon">
      {kinds.map((item, index) => (
        <div 
          key={index}
          className={`text-${item.kind} bg-${item.kind}/15 dark:text-${item.kind}Dark dark:bg-${item.kind}Dark/15`}
          title={item.title}
        >
          {item.char}
        </div>
      ))}
    </div>
  );
};