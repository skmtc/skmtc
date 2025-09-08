import { DocsJson, DocNode, JsDoc } from './types';

/**
 * Utility functions for processing DocsJson data
 */

export const titleCase = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const extractTags = (jsDoc?: JsDoc) => {
  if (!jsDoc?.tags) return [];
  
  return jsDoc.tags.map(tag => ({
    kind: tag.kind,
    value: tag.name || tag.doc
  }));
};

export const isDeprecated = (jsDoc?: JsDoc): string | null => {
  const deprecatedTag = jsDoc?.tags?.find(tag => tag.kind === 'deprecated');
  return deprecatedTag?.doc || null;
};

export const getNodesByKind = (docsJson: DocsJson, kind: string): DocNode[] => {
  return docsJson.nodes.filter(node => node.kind === kind);
};

export const getModuleDoc = (docsJson: DocsJson) => {
  return docsJson.nodes.find(node => node.kind === 'moduleDoc');
};

export const formatNodeName = (node: DocNode): string => {
  return node.name;
};

export const getSourceUrl = (node: DocNode, baseUrl?: string): string | undefined => {
  if (!baseUrl) return undefined;
  return `${baseUrl}/${node.location.filename}#L${node.location.line}`;
};

export const buildBreadcrumbs = (
  nodeName: string, 
  moduleName?: string
): Array<{ name: string; href?: string; isSymbol?: boolean }> => {
  const breadcrumbs: Array<{ name: string; href?: string; isSymbol?: boolean }> = [];
  
  if (moduleName) {
    breadcrumbs.push({ name: moduleName, href: '/' });
  }
  
  breadcrumbs.push({ name: nodeName, isSymbol: true });
  
  return breadcrumbs;
};

export const categorizeNodes = (docsJson: DocsJson) => {
  const categories = {
    functions: getNodesByKind(docsJson, 'function'),
    classes: getNodesByKind(docsJson, 'class'),
    interfaces: getNodesByKind(docsJson, 'interface'),
    types: getNodesByKind(docsJson, 'typeAlias'),
    variables: getNodesByKind(docsJson, 'variable'),
    enums: getNodesByKind(docsJson, 'enum'),
    namespaces: getNodesByKind(docsJson, 'namespace')
  };
  
  return categories;
};

export const buildCategoryLinks = (
  categories: ReturnType<typeof categorizeNodes>,
  currentCategory?: string
) => {
  const links: Array<{ name: string; href: string; active?: boolean }> = [];
  
  Object.entries(categories).forEach(([key, nodes]) => {
    if (nodes.length > 0) {
      links.push({
        name: titleCase(key),
        href: `#${key}`,
        active: currentCategory === key
      });
    }
  });
  
  return links;
};

export const renderTypeDefinition = (tsType: any): string => {
  // This would need complex type rendering logic
  // For now, return the representation string
  return tsType?.repr || 'unknown';
};

// Re-export JSDoc link utilities
export * from './utils/jsdoc-links';