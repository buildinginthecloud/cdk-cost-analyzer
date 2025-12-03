import { describe, it, expect } from 'vitest';
import { EC2Calculator } from '../../src/pricing/calculators/EC2Calculator';
import { S3Calculator } from '../../src/pricing/calculators/S3Calculator';
import { LambdaCalculator } from '../../src/pricing/calculators/LambdaCalculator';
import { RDSCalculator } from '../../src/pricing/calculators/RDSCalculator';

describe('Resource Cost Calculators', () => {
  describe('EC2Calculator', () => {
    const calculator = new EC2Calculator();

    it('should support AWS::EC2::Instance', () => {
      expect(calculator.supports('AWS::EC2::Instance')).toBe(true);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    });
  });

  describe('S3Calculator', () => {
    const calculator = new S3Calculator();

    it('should support AWS::S3::Bucket', () => {
      expect(calculator.supports('AWS::S3::Bucket')).toBe(true);
      expect(calculator.supports('AWS::EC2::Instance')).toBe(false);
    });
  });

  describe('LambdaCalculator', () => {
    const calculator = new LambdaCalculator();

    it('should support AWS::Lambda::Function', () => {
      expect(calculator.supports('AWS::Lambda::Function')).toBe(true);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    });
  });

  describe('RDSCalculator', () => {
    const calculator = new RDSCalculator();

    it('should support AWS::RDS::DBInstance', () => {
      expect(calculator.supports('AWS::RDS::DBInstance')).toBe(true);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    });
  });
});
