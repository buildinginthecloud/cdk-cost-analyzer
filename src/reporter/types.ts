import { CostDelta } from '../pricing/types';

export interface Reporter {
  generateReport(costDelta: CostDelta, format: ReportFormat): string;
}

export type ReportFormat = 'text' | 'json' | 'markdown';
