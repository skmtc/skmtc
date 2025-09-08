import React from 'react';
import { Anchor } from './Anchor';

interface ExampleProps {
  anchor: {
    id: string;
  };
  markdownTitle: string;
  markdownBody: string;
}

export const Example: React.FC<ExampleProps> = ({ anchor, markdownTitle, markdownBody }) => {
  return (
    <div className="anchorable">
      <Anchor id={anchor.id} />
      
      <h3 className="example-header">
        <div dangerouslySetInnerHTML={{ __html: markdownTitle }} />
      </h3>
      
      <div>
        <div dangerouslySetInnerHTML={{ __html: markdownBody }} />
      </div>
    </div>
  );
};