import { z } from 'zod';
import { type Method, method } from '@skmtc/core/Method';

export type SettingMetaOperation = {
  type: 'operation';
  path: string;
  method: Method;
  generatorId: string;
};

export const settingMetaOperation: z.ZodType<SettingMetaOperation> = z.object({
  type: z.literal('operation'),
  path: z.string(),
  method: method,
  generatorId: z.string(),
});

export type SettingMetaModel = {
  type: 'model';
  refName: string;
  generatorId: string;
};

export const settingMetaModel = z.object({
  type: z.literal('model'),
  refName: z.string(),
  generatorId: z.string(),
});

export type SettingMetaGenerator = {
  type: 'generator';
  generatorId: string;
};

export const settingMetaGenerator = z.object({
  type: z.literal('generator'),
  generatorId: z.string(),
});

export type SettingMetaGenerators = {
  type: 'generators';
};

export type SettingMetaSchema = {
  type: 'schema';
  schemaNodeType?: string;
  stackTrail: string[];
};

export const settingMetaSchema = z.object({
  type: z.literal('schema'),
  schemaNodeType: z.string().optional(),
  stackTrail: z.array(z.string()),
});

export const settingMetaGenerators = z.object({
  type: z.literal('generators'),
});

export type SettingMeta =
  | SettingMetaOperation
  | SettingMetaModel
  | SettingMetaGenerator
  | SettingMetaGenerators
  | SettingMetaSchema;

export const settingMeta = z.union([
  settingMetaOperation,
  settingMetaModel,
  settingMetaGenerator,
  settingMetaGenerators,
  settingMetaSchema,
]);

export type BaseSettingMeta = SettingMetaOperation | SettingMetaModel | SettingMetaGenerator;

export const baseSettingMeta = z.union([
  settingMetaOperation,
  settingMetaModel,
  settingMetaGenerator,
]);

export type SettingWithMeta = {
  selected: boolean;
  meta: SettingMeta;
};

export const settingWithMeta = z.object({
  selected: z.boolean(),
  meta: settingMeta,
});

export type BaseSettingWithMeta = {
  selected: boolean;
  meta: BaseSettingMeta;
};

export const baseSettingWithMeta = z.object({
  selected: z.boolean(),
  meta: baseSettingMeta,
});
