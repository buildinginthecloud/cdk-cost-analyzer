import { ResourceCost } from '../pricing/types';

export interface ThresholdEvaluation {
  passed: boolean;
  level: 'none' | 'warning' | 'error';
  threshold?: number;
  delta: number;
  message: string;
  recommendations: string[];
}

export class ThresholdExceededError extends Error {
  constructor(
    message: string,
    public threshold: number,
    public actualDelta: number,
    public topContributors: ResourceCost[],
  ) {
    super(message);
    this.name = 'ThresholdExceededError';
  }
}
