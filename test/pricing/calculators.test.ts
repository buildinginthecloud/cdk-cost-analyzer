import { describe, it, expect } from 'vitest';
import { EC2Calculator } from '../../src/pricing/calculators/EC2Calculator';
import { S3Calculator } from '../../src/pricing/calculators/S3Calculator';
import { LambdaCalculator } from '../../src/pricing/calculators/LambdaCalculator';
import { RDSCalculator } from '../../src/pricing/calculators/RDSCalculator';
import { DynamoDBCalculator } from '../../src/pricing/calculators/DynamoDBCalculator';
import { ECSCalculator } from '../../src/pricing/calculators/ECSCalculator';
import { APIGatewayCalculator } from '../../src/pricing/calculators/APIGatewayCalculator';

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

  describe('DynamoDBCalculator', () => {
    const calculator = new DynamoDBCalculator();

    it('should support AWS::DynamoDB::Table', () => {
      expect(calculator.supports('AWS::DynamoDB::Table')).toBe(true);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    });
  });

  describe('ECSCalculator', () => {
    const calculator = new ECSCalculator();

    it('should support AWS::ECS::Service', () => {
      expect(calculator.supports('AWS::ECS::Service')).toBe(true);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    });
  });

  describe('APIGatewayCalculator', () => {
    const calculator = new APIGatewayCalculator();

    it('should support AWS::ApiGateway::RestApi', () => {
      expect(calculator.supports('AWS::ApiGateway::RestApi')).toBe(true);
      expect(calculator.supports('AWS::S3::Bucket')).toBe(false);
    });

    it('should support AWS::ApiGatewayV2::Api', () => {
      expect(calculator.supports('AWS::ApiGatewayV2::Api')).toBe(true);
    });
  });
});
