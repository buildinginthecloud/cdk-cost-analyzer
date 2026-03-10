import { OptimizationAnalyzer } from './types';
import { GravitonMigrationAnalyzer } from './analyzers/GravitonMigrationAnalyzer';
import { NATGatewayOptimizationAnalyzer } from './analyzers/NATGatewayOptimizationAnalyzer';
import { StorageOptimizationAnalyzer } from './analyzers/StorageOptimizationAnalyzer';
import { ReservedInstanceAnalyzer } from './analyzers/ReservedInstanceAnalyzer';
import { SavingsPlansAnalyzer } from './analyzers/SavingsPlansAnalyzer';
import { RightSizingAnalyzer } from './analyzers/RightSizingAnalyzer';
import { SpotInstanceAnalyzer } from './analyzers/SpotInstanceAnalyzer';

export function createDefaultAnalyzers(): OptimizationAnalyzer[] {
  return [
    new GravitonMigrationAnalyzer(),
    new NATGatewayOptimizationAnalyzer(),
    new StorageOptimizationAnalyzer(),
    new ReservedInstanceAnalyzer(),
    new SavingsPlansAnalyzer(),
    new RightSizingAnalyzer(),
    new SpotInstanceAnalyzer(),
  ];
}
