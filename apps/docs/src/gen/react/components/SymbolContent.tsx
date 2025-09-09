import React from 'react';
import { parseMarkdown } from '../utils/jsdoc-links';
import { formatTsType } from '../utils';
import type { 
  DocNode, 
  ClassDef, 
  InterfaceDef, 
  EnumDef, 
  TypeAliasDef,
  VariableDef,
  NamespaceDef
} from '../types';

interface SymbolContentProps {
  value: React.ReactNode | unknown;
}

export const SymbolContent: React.FC<SymbolContentProps> = ({ value }) => {
  if (!value) return null;

  if (typeof value === 'string') {
    return (
      <div 
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(value) }}
      />
    );
  }

  if (typeof value === 'object' && value !== null) {
    if ('kind' in value) {
      const node = value as DocNode;
      
      switch (node.kind) {
        case 'class':
          return <ClassContent classDef={node.classDef} />;
        case 'interface':
          return <InterfaceContent interfaceDef={node.interfaceDef} />;
        case 'enum':
          return <EnumContent enumDef={node.enumDef} />;
        case 'typeAlias':
          return <TypeAliasContent typeAliasDef={node.typeAliasDef} />;
        case 'variable':
          return <VariableContent variableDef={node.variableDef} />;
        case 'namespace':
          return <NamespaceContent namespaceDef={node.namespaceDef} />;
        default:
          return <GenericContent value={value} />;
      }
    }
  }

  return <GenericContent value={value} />;
};

const ClassContent: React.FC<{ classDef: ClassDef }> = ({ classDef }) => {
  return (
    <div className="class-content">
      {classDef.constructors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3">Constructors</h4>
          {classDef.constructors.map((constructor, index) => (
            <div key={index} className="mb-4 pl-4 border-l-2 border-gray-200">
              <code className="text-sm">
                constructor({constructor.params.map((p, i) => {
                  if (p.kind === 'identifier') return p.name || `param${i}`;
                  return `param${i}`;
                }).join(', ')})
              </code>
              {constructor.jsDoc?.doc && (
                <div 
                  className="mt-2 text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(constructor.jsDoc.doc) }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {classDef.properties.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3">Properties</h4>
          <div className="space-y-3">
            {classDef.properties.map((property, index) => (
              <div key={index} className="pl-4 border-l-2 border-gray-200">
                <code className="text-sm">
                  {property.isStatic && 'static '}
                  {property.readonly && 'readonly '}
                  {property.name}
                  {property.optional && '?'}
                  {property.tsType && `: ${formatTsType(property.tsType)}`}
                </code>
                {property.jsDoc?.doc && (
                  <div 
                    className="mt-1 text-sm text-gray-700"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(property.jsDoc.doc) }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {classDef.methods.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3">Methods</h4>
          <div className="space-y-4">
            {classDef.methods.map((method, index) => (
              <div key={index} className="pl-4 border-l-2 border-gray-200">
                <code className="text-sm">
                  {method.isStatic && 'static '}
                  {method.isAbstract && 'abstract '}
                  {method.name}({method.functionDef.params.map(() => '...').join(', ')})
                  {method.functionDef.returnType && `: ${formatTsType(method.functionDef.returnType)}`}
                </code>
                {method.jsDoc?.doc && (
                  <div 
                    className="mt-1 text-sm text-gray-700"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(method.jsDoc.doc) }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const InterfaceContent: React.FC<{ interfaceDef: InterfaceDef }> = ({ interfaceDef }) => {
  return (
    <div className="interface-content">
      {interfaceDef.properties.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3">Properties</h4>
          <div className="space-y-3">
            {interfaceDef.properties.map((property, index) => (
              <div key={index} className="pl-4 border-l-2 border-gray-200">
                <code className="text-sm">
                  {property.name}
                  {property.optional && '?'}
                  : {formatTsType(property.tsType)}
                </code>
                {property.jsDoc?.doc && (
                  <div 
                    className="mt-1 text-sm text-gray-700"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(property.jsDoc.doc) }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {interfaceDef.methods.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3">Methods</h4>
          <div className="space-y-4">
            {interfaceDef.methods.map((method, index) => (
              <div key={index} className="pl-4 border-l-2 border-gray-200">
                <code className="text-sm">
                  {method.name}({method.params.map(() => '...').join(', ')})
                  {method.returnType && `: ${formatTsType(method.returnType)}`}
                </code>
                {method.jsDoc?.doc && (
                  <div 
                    className="mt-1 text-sm text-gray-700"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(method.jsDoc.doc) }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EnumContent: React.FC<{ enumDef: EnumDef }> = ({ enumDef }) => {
  return (
    <div className="enum-content">
      <h4 className="text-lg font-semibold mb-3">Members</h4>
      <div className="space-y-2">
        {enumDef.members.map((member, index) => (
          <div key={index} className="pl-4 border-l-2 border-gray-200">
            <code className="text-sm">
              {member.name}
              {member.init && ` = ${formatTsType(member.init)}`}
            </code>
            {member.jsDoc?.doc && (
              <div 
                className="mt-1 text-sm text-gray-700"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(member.jsDoc.doc) }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const TypeAliasContent: React.FC<{ typeAliasDef: TypeAliasDef }> = ({ typeAliasDef }) => {
  return (
    <div className="type-alias-content">
      <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
        <code>
          type{' '}
          {typeAliasDef.typeParams.length > 0 && 
            `<${typeAliasDef.typeParams.map(tp => tp.name).join(', ')}> `}
          = {formatTsType(typeAliasDef.tsType)}
        </code>
      </pre>
    </div>
  );
};

const VariableContent: React.FC<{ variableDef: VariableDef }> = ({ variableDef }) => {
  return (
    <div className="variable-content">
      <code className="bg-gray-100 px-2 py-1 rounded">
        {variableDef.kind} : {formatTsType(variableDef.tsType)}
      </code>
    </div>
  );
};

const NamespaceContent: React.FC<{ namespaceDef: NamespaceDef }> = ({ namespaceDef }) => {
  return (
    <div className="namespace-content">
      <h4 className="text-lg font-semibold mb-3">Namespace Elements</h4>
      <div className="space-y-2">
        {namespaceDef.elements.map((element, index) => (
          <div key={index} className="pl-4 border-l-2 border-gray-200">
            <code className="text-sm">
              {element.kind}: {element.name}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
};

const GenericContent: React.FC<{ value: unknown }> = ({ value }) => {
  return (
    <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
};