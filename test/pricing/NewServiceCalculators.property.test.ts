import * as fc from 'fast-check';
// Jest globals are available without an explicit import
import { WAFCalculator } from '../../src/pricing/calculators/WAFCalculator';
import { GlueCalculator } from '../../src/pricing/calculators/GlueCalculator';
import { AthenaCalculator } from '../../src/pricing/calculators/AthenaCalculator';
import { FSxCalculator } from '../../src/pricing/calculators/FSxCalculator';
import { AppRunnerCalculator } from '../../src/pricing/calculators/AppRunnerCalculator';
import { BatchCalculator } from '../../src/pricing/calculators/BatchCalculator';
import { PricingClient } from '../../src/pricing/types';

const VALID_CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unknown'];

describe('Fixed-rate new calculators: property tests', () => {
  const mockPricingClient: PricingClient = {
    getPrice: jest.fn().mockResolvedValue(0.1),
  };

  // ─── WAF ─────────────────────────────────────────────────────────────────

  describe('WAFCalculator', () => {
    it('always returns non-negative amount, USD currency, and valid confidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 20 }),
          fc.nat({ max: 10_000_000 }),
          async (ruleCount, requests) => {
            const calc = new WAFCalculator(requests);
            const resource = {
              logicalId: 'TestWAF',
              type: 'AWS::WAFv2::WebACL',
              properties: { Rules: Array(ruleCount).fill({ Name: 'rule' }) },
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount >= 0 &&
              result.currency === 'USD' &&
              VALID_CONFIDENCE_LEVELS.includes(result.confidence)
            );
          },
        ),
      );
    });
  });

  // ─── Glue ────────────────────────────────────────────────────────────────

  describe('GlueCalculator', () => {
    it('always returns non-negative amount for AWS::Glue::Job', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 1_000 }),
          async (hoursPerMonth) => {
            const calc = new GlueCalculator(hoursPerMonth);
            const resource = {
              logicalId: 'TestGlueJob',
              type: 'AWS::Glue::Job',
              properties: {},
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount >= 0 &&
              result.currency === 'USD' &&
              VALID_CONFIDENCE_LEVELS.includes(result.confidence)
            );
          },
        ),
      );
    });

    it('always returns non-negative amount for AWS::Glue::Crawler', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 1_000 }),
          async (hoursPerMonth) => {
            const calc = new GlueCalculator(hoursPerMonth);
            const resource = {
              logicalId: 'TestGlueCrawler',
              type: 'AWS::Glue::Crawler',
              properties: {},
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount >= 0 &&
              result.currency === 'USD' &&
              VALID_CONFIDENCE_LEVELS.includes(result.confidence)
            );
          },
        ),
      );
    });
  });

  // ─── Athena ──────────────────────────────────────────────────────────────

  describe('AthenaCalculator', () => {
    it('always returns non-negative amount for AWS::Athena::WorkGroup', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: 1_000, noNaN: true }),
          async (tbScanned) => {
            const calc = new AthenaCalculator(tbScanned);
            const resource = {
              logicalId: 'TestWorkGroup',
              type: 'AWS::Athena::WorkGroup',
              properties: {},
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount >= 0 &&
              result.currency === 'USD' &&
              VALID_CONFIDENCE_LEVELS.includes(result.confidence)
            );
          },
        ),
      );
    });

    it('always returns $0 for AWS::Athena::NamedQuery', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 100 }),
          async (_unused) => {
            const calc = new AthenaCalculator();
            const resource = {
              logicalId: 'TestNamedQuery',
              type: 'AWS::Athena::NamedQuery',
              properties: {},
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount === 0 &&
              result.currency === 'USD' &&
              result.confidence === 'high'
            );
          },
        ),
      );
    });
  });

  // ─── FSx ─────────────────────────────────────────────────────────────────

  describe('FSxCalculator', () => {
    it('always returns non-negative amount for all file system types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('WINDOWS', 'LUSTRE', 'ONTAP', 'OPENZFS'),
          fc.nat({ max: 65_536 }),
          async (fsType, storageCapacity) => {
            const calc = new FSxCalculator();
            const resource = {
              logicalId: 'TestFSx',
              type: 'AWS::FSx::FileSystem',
              properties: {
                FileSystemType: fsType,
                StorageCapacity: storageCapacity,
              },
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount >= 0 &&
              result.currency === 'USD' &&
              VALID_CONFIDENCE_LEVELS.includes(result.confidence)
            );
          },
        ),
      );
    });

    it('customStorageGB override always yields non-negative amount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 65_536 }),
          async (storageGB) => {
            const calc = new FSxCalculator(storageGB);
            const resource = {
              logicalId: 'TestFSxCustom',
              type: 'AWS::FSx::FileSystem',
              properties: { FileSystemType: 'WINDOWS' },
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return result.amount >= 0 && result.currency === 'USD';
          },
        ),
      );
    });
  });

  // ─── App Runner ──────────────────────────────────────────────────────────

  describe('AppRunnerCalculator', () => {
    it('always returns non-negative amount for valid CPU/memory strings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('0.25 vCPU', '0.5 vCPU', '1 vCPU', '2 vCPU', '4 vCPU'),
          fc.constantFrom('0.5 GB', '1 GB', '2 GB', '3 GB', '4 GB', '6 GB', '8 GB', '12 GB'),
          fc.nat({ max: 10_000_000 }),
          fc.nat({ max: 730 }),
          async (cpu, memory, requests, hours) => {
            const calc = new AppRunnerCalculator(requests, hours);
            const resource = {
              logicalId: 'TestAppRunner',
              type: 'AWS::AppRunner::Service',
              properties: {
                InstanceConfiguration: { Cpu: cpu, Memory: memory },
              },
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount >= 0 &&
              result.currency === 'USD' &&
              VALID_CONFIDENCE_LEVELS.includes(result.confidence)
            );
          },
        ),
      );
    });
  });

  // ─── Batch ───────────────────────────────────────────────────────────────

  describe('BatchCalculator', () => {
    it('always returns non-negative amount for AWS::Batch::ComputeEnvironment (FARGATE/EC2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('FARGATE', 'FARGATE_SPOT', 'EC2', 'SPOT'),
          fc.nat({ max: 730 }),
          async (computeType, hours) => {
            const calc = new BatchCalculator(hours);
            const resource = {
              logicalId: 'TestComputeEnv',
              type: 'AWS::Batch::ComputeEnvironment',
              properties: { ComputeResources: { Type: computeType } },
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount >= 0 &&
              result.currency === 'USD' &&
              VALID_CONFIDENCE_LEVELS.includes(result.confidence)
            );
          },
        ),
      );
    });

    it('always returns $0 for AWS::Batch::JobDefinition', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 100 }),
          async (_unused) => {
            const calc = new BatchCalculator();
            const resource = {
              logicalId: 'TestJobDef',
              type: 'AWS::Batch::JobDefinition',
              properties: {},
            };
            const result = await calc.calculateCost(resource, 'us-east-1', mockPricingClient);
            return (
              result.amount === 0 &&
              result.currency === 'USD' &&
              result.confidence === 'high'
            );
          },
        ),
      );
    });
  });
});
