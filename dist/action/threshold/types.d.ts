import { ResourceCost } from '../pricing/types';
export interface ThresholdEvaluation {
    passed: boolean;
    level: 'none' | 'warning' | 'error';
    threshold?: number;
    delta: number;
    message: string;
    recommendations: string[];
}
export declare class ThresholdExceededError extends Error {
    threshold: number;
    actualDelta: number;
    topContributors: ResourceCost[];
    constructor(message: string, threshold: number, actualDelta: number, topContributors: ResourceCost[]);
}
