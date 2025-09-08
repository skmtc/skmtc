import React from 'react';

interface HtmlHeadProps {
  title: string;
  currentFile?: string;
  stylesheetUrl?: string;
  pageStylesheetUrl?: string;
  resetStylesheetUrl?: string;
  headInject?: string;
  scriptJs?: string;
  darkmodeToggleJs?: string;
  disableSearch?: boolean;
  urlSearchIndex?: string;
  fuseJs?: string;
  searchJs?: string;
}

export const HtmlHead: React.FC<HtmlHeadProps> = ({
  title,
  currentFile,
  stylesheetUrl,
  pageStylesheetUrl,
  resetStylesheetUrl,
  headInject,
  scriptJs,
  darkmodeToggleJs,
  disableSearch = false,
  urlSearchIndex,
  fuseJs,
  searchJs
}) => {
  return (
    <head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      {currentFile && <meta name="doc-current-file" content={currentFile} />}
      
      {stylesheetUrl && <link rel="stylesheet" href={stylesheetUrl} />}
      {pageStylesheetUrl && <link rel="stylesheet" href={pageStylesheetUrl} />}
      {resetStylesheetUrl && (
        <link id="ddocResetStylesheet" rel="stylesheet" href={resetStylesheetUrl} />
      )}
      
      {headInject && <div dangerouslySetInnerHTML={{ __html: headInject }} />}
      
      {scriptJs && <script src={scriptJs} defer />}
      {darkmodeToggleJs && <script src={darkmodeToggleJs} />}
      
      {!disableSearch && (
        <>
          {urlSearchIndex && <script src={urlSearchIndex} defer />}
          {fuseJs && <script src={fuseJs} defer />}
          {searchJs && <script src={searchJs} defer />}
        </>
      )}
    </head>
  );
};