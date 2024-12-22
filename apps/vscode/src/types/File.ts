export type DenoFile = {
  kind: 'file';
  content: string;
  encoding: 'utf-8' | 'base64';
};

export type DenoFiles = Record<string, DenoFile>;
