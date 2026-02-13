import { ThresholdEvaluation } from './types';
import { ThresholdConfig } from '../config/types';
import { ResourceCost, ModifiedResourceCost } from '../pricing/types';
export declare class ThresholdEnforcer {
    /**
     * Evaluate cost delta against configured thresholds
     */
    evaluateThreshold(costDelta: number, addedResources: ResourceCost[], modifiedResources: ModifiedResourceCost[], config?: ThresholdConfig, environment?: string): ThresholdEvaluation;
    /**
     * Select appropriate threshold based on environment
     */
    private selectThresholds;
    /**
     * Get top cost contributors sorted by impact
     */
    private getTopContributors;
    /**
     * Format error threshold message
     */
    private formatErrorMessage;
    /**
     * Format warning threshold message
     */
    private formatWarningMessage;
    /**
     * Get recommendations based on threshold level and contributors
     */
    private getRecommendations;
}
