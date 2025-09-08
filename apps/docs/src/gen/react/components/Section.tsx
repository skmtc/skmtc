import React from 'react';
import { Anchor } from './Anchor';

interface SectionHeader {
  anchor: {
    id: string;
  };
  href?: string;
  title: string;
  doc?: string;
}

interface SectionContent {
  kind: string;
  content: any[];
}

interface SectionProps {
  header?: SectionHeader;
  content: SectionContent;
}

export const Section: React.FC<SectionProps> = ({ header, content }) => {
  const renderContent = () => {
    if (content.kind === 'empty') {
      return null;
    }

    if (content.kind === 'namespace_section' || content.kind === 'see') {
      // These would need specific components - for now render as generic
      return (
        <div>
          {/* TODO: Implement specific components for namespace_section and see */}
          <pre>{JSON.stringify(content.content, null, 2)}</pre>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {content.content.map((item: any, index: number) => {
          // This would need dynamic component rendering based on content.kind
          // For now, render as generic content
          const isExample = content.kind === 'example';
          const isLast = index === content.content.length - 1;
          
          return (
            <React.Fragment key={index}>
              <div>
                {/* TODO: Implement dynamic component rendering */}
                <pre>{JSON.stringify(item, null, 2)}</pre>
              </div>
              {isExample && !isLast && (
                <div className="border-b border-gray-300 dark:border-gray-700"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <section 
      className="section" 
      id={header?.anchor?.id}
    >
      {header && (
        <div>
          <h2 className="anchorable mb-1">
            <Anchor id={header.anchor.id} />
            
            {header.href ? (
              <a href={header.href} className="contextLink">
                {header.title}
              </a>
            ) : (
              header.title
            )}
          </h2>

          {header.doc && (
            <div dangerouslySetInnerHTML={{ __html: header.doc }} />
          )}
        </div>
      )}

      {renderContent()}
    </section>
  );
};