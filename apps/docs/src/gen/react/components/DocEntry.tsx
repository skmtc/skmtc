import React from 'react';
import { Anchor } from './Anchor';
import { Tag } from './Tag';
import { SourceButton } from './SourceButton';

interface DocEntryProps {
  id?: string;
  name?: string;
  nameHref?: string;
  content: string;
  tags?: Array<{ kind: string; value?: string | string[] }>;
  sourceHref?: string;
  jsDoc?: string;
}

export const DocEntry: React.FC<DocEntryProps> = ({
  id,
  name,
  nameHref,
  content,
  tags,
  sourceHref,
  jsDoc
}) => {
  const hasName = Boolean(name);

  return (
    <div className={`${hasName ? 'anchorable' : ''} docEntry`} id={id}>
      <div className="docEntryHeader">
        <div>
          {tags && (
            <div className="space-x-1 mb-1">
              {tags.map((tag, index) => (
                <Tag key={index} value={tag} />
              ))}
            </div>
          )}

          <code>
            {name && <Anchor id={id || ''} />}

            {nameHref ? (
              <a className="font-bold text-lg link" href={nameHref}>
                <span dangerouslySetInnerHTML={{ __html: name || '' }} />
              </a>
            ) : (
              name && (
                <span className="font-bold text-lg">
                  <span dangerouslySetInnerHTML={{ __html: name }} />
                </span>
              )
            )}
            <span 
              className="font-medium text-stone-500 dark:text-stone-200"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </code>
        </div>

        {sourceHref && <SourceButton href={sourceHref} />}
      </div>

      {jsDoc && (
        <div className="max-w-[75ch]">
          <div dangerouslySetInnerHTML={{ __html: jsDoc }} />
        </div>
      )}
    </div>
  );
};