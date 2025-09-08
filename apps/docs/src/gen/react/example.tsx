/**
 * Example usage of the React documentation generator
 * 
 * This demonstrates how to use the DocsApp component with sample data
 * that matches the DocsJson structure.
 */

import React from 'react';
import { DocsApp } from './DocsApp';
import { DocsJson } from './types';

// Sample DocsJson data for testing
const sampleDocsData: DocsJson = {
  version: 1,
  nodes: [
    {
      name: "MyModule",
      kind: "moduleDoc",
      location: {
        filename: "mod.ts",
        line: 1,
        col: 1,
        byteIndex: 0
      },
      declarationKind: "export",
      jsDoc: {
        doc: "This is a sample module for testing the documentation generator.",
        tags: [
          {
            kind: "module",
            name: "MyModule",
            doc: "Sample module documentation"
          }
        ]
      }
    },
    {
      name: "sampleFunction",
      kind: "function", 
      location: {
        filename: "mod.ts",
        line: 10,
        col: 1,
        byteIndex: 200
      },
      declarationKind: "export",
      functionDef: {
        params: [
          {
            kind: "identifier",
            name: "input",
            tsType: {
              kind: "keyword",
              keyword: "string",
              repr: "string"
            }
          }
        ],
        returnType: {
          kind: "keyword", 
          keyword: "string",
          repr: "string"
        },
        hasBody: true,
        isAsync: false,
        isGenerator: false,
        typeParams: []
      },
      jsDoc: {
        doc: "A sample function that processes a string input.",
        tags: [
          {
            kind: "param",
            name: "input",
            doc: "The string to process"
          },
          {
            kind: "returns",
            doc: "The processed string"
          }
        ]
      }
    },
    {
      name: "SampleClass",
      kind: "class",
      location: {
        filename: "mod.ts", 
        line: 20,
        col: 1,
        byteIndex: 400
      },
      declarationKind: "export",
      classDef: {
        isAbstract: false,
        constructors: [],
        properties: [
          {
            name: "value",
            location: {
              filename: "mod.ts",
              line: 21,
              col: 3,
              byteIndex: 420
            },
            readonly: false,
            optional: false,
            isAbstract: false,
            isStatic: false,
            tsType: {
              kind: "keyword",
              keyword: "string", 
              repr: "string"
            }
          }
        ],
        methods: [],
        indexSignatures: [],
        implements: [],
        typeParams: []
      },
      jsDoc: {
        doc: "A sample class for demonstration purposes."
      }
    }
  ]
};

// Sample usage configuration
const samplePageConfig = {
  title: "Sample Documentation",
  stylesheetUrl: "/styles.css",
  pageStylesheetUrl: "/page.css", 
  resetStylesheetUrl: "/reset.css",
  scriptJs: "/script.js",
  darkmodeToggleJs: "/darkmode.js",
  disableSearch: false
};

const sampleCategories = [
  { name: "Functions", href: "#functions", active: false },
  { name: "Classes", href: "#classes", active: false },
  { name: "Interfaces", href: "#interfaces", active: false }
];

const sampleBreadcrumbs = [
  { name: "Home", href: "/" },
  { name: "MyModule" }
];

// Example React component demonstrating the documentation generator
export const ExampleApp: React.FC = () => {
  return (
    <DocsApp
      docsData={sampleDocsData}
      pageType="index"
      pageConfig={samplePageConfig}
      categories={sampleCategories}
      allSymbolsHref="/all-symbols"
      totalSymbols={3}
      breadcrumbs={sampleBreadcrumbs}
    />
  );
};

// Example for a specific symbol page using slug
export const ExampleSymbolApp: React.FC = () => {
  return (
    <DocsApp
      docsData={sampleDocsData}
      slug={["sampleFunction"]}
      pageConfig={samplePageConfig}
      categories={sampleCategories}
      allSymbolsHref="/all-symbols"
      totalSymbols={3}
      breadcrumbs={[...sampleBreadcrumbs, { name: "sampleFunction", isSymbol: true }]}
    />
  );
};

// Example for index page (root)
export const ExampleIndexApp: React.FC = () => {
  return (
    <DocsApp
      docsData={sampleDocsData}
      slug={[]}
      pageConfig={samplePageConfig}
      categories={sampleCategories}
      allSymbolsHref="/all-symbols"
      totalSymbols={3}
      breadcrumbs={sampleBreadcrumbs}
    />
  );
};

// Example for class symbol page
export const ExampleClassApp: React.FC = () => {
  return (
    <DocsApp
      docsData={sampleDocsData}
      slug={["SampleClass"]}
      pageConfig={samplePageConfig}
      categories={sampleCategories}
      allSymbolsHref="/all-symbols"
      totalSymbols={3}
      breadcrumbs={[...sampleBreadcrumbs, { name: "SampleClass", isSymbol: true }]}
    />
  );
};

// Example for nested namespace symbol
export const ExampleNestedSymbolApp: React.FC = () => {
  return (
    <DocsApp
      docsData={sampleDocsData}
      slug={["SomeNamespace", "NestedFunction"]}
      pageConfig={samplePageConfig}
      categories={sampleCategories}
      allSymbolsHref="/all-symbols"
      totalSymbols={3}
      breadcrumbs={[...sampleBreadcrumbs, { name: "SomeNamespace.NestedFunction", isSymbol: true }]}
    />
  );
};