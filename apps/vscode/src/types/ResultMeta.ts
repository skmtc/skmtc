import { ResultType } from '@skmtc/core/Results';

export type ResultMeta = {
  deploymentId: string;
  location: 'local' | 'remote';
  result: ResultType;
  startAt: number;
  endAt: number;
};
