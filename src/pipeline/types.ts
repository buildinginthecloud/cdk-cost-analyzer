import { CostAnalysisResult } from '../api/types';
import { ThresholdEvaluation } from '../threshold/types';

export interface PipelineOptions {
  baseTemplate?: string;
  targetTemplate?: string;
  baseBranch?: string;
  targetBranch?: string;
  cdkAppPath?: string;
  configPath?: string;
  region?: string;
  synthesize?: boolean;
  environment?: string;
}

export interface PipelineResult {
  costAnalysis: CostAnalysisResult;
  thresholdStatus: ThresholdEvaluation;
  synthesisInfo?: SynthesisInfo;
  configUsed: ConfigSummary;
}

export interface SynthesisInfo {
  baseStackCount: number;
  targetStackCount: number;
  baseSynthesisTime: number;
  targetSynthesisTime: number;
}

export interface ConfigSummary {
  configPath?: string;
  thresholds?: {
    warning?: number;
    error?: number;
    environment?: string;
  };
  usageAssumptions?: Record<string, unknown>;
  excludedResourceTypes?: string[];
  synthesisEnabled: boolean;
}

export class PipelineError extends Error {
  constructor(message: string, public stage: string) {
    super(message);
    this.name = 'PipelineError';
  }
}
