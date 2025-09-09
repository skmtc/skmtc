import React from 'react';
import ReactDOM from 'react-dom/client';
import { DocsApp } from './DocsApp';
import type { DocsJson } from './types';

async function loadDocs() {
  try {
    const response = await fetch('/src/gen/docs.json');
    const docsJson: DocsJson = await response.json();
    
    const root = ReactDOM.createRoot(
      document.getElementById('root') as HTMLElement
    );
    
    root.render(
      <React.StrictMode>
        <DocsApp docsJson={docsJson} currentPath={window.location.pathname} />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to load documentation:', error);
  }
}

loadDocs();