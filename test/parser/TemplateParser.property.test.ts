import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TemplateParser } from '../../src/parser/TemplateParser';
import { CloudFormationTemplate } from '../../src/parser/types';

describe('TemplateParser - Property Tests', () => {
  const parser = new TemplateParser();

  // Feature: cdk-cost-analyzer, Property 1: Template parsing succeeds for valid templates
  it('should successfully parse any valid CloudFormation template', () => {
    const resourceTypeArb = fc.constantFrom(
      'AWS::S3::Bucket',
      'AWS::EC2::Instance',
      'AWS::Lambda::Function',
      'AWS::RDS::DBInstance'
    );

    const resourceArb = fc.record({
      Type: resourceTypeArb,
      Properties: fc.dictionary(fc.string(), fc.anything()),
    });

    const templateArb = fc.record({
      Resources: fc.dictionary(
        fc.string().filter(s => s.length > 0),
        resourceArb,
        { minKeys: 1 }
      ),
      AWSTemplateFormatVersion: fc.option(fc.constant('2010-09-09'), { nil: undefined }),
      Description: fc.option(fc.string(), { nil: undefined }),
    });

    fc.assert(
      fc.property(templateArb, fc.constantFrom('json', 'yaml'), (template, format) => {
        let content: string;
        if (format === 'json') {
          content = JSON.stringify(template);
        } else {
          const yaml = require('js-yaml');
          content = yaml.dump(template);
        }

        const result = parser.parse(content);
        
        expect(result).toBeDefined();
        expect(result.Resources).toBeDefined();
        expect(Object.keys(result.Resources).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: cdk-cost-analyzer, Property 10: Unsupported resources don't cause failures
  it('should parse templates with unsupported resource types without errors', () => {
    const unsupportedResourceTypes = [
      'AWS::ECS::Cluster',
      'AWS::ElasticLoadBalancingV2::LoadBalancer',
      'AWS::CloudFront::Distribution',
      'AWS::ApiGateway::RestApi',
      'Custom::MyCustomResource'
    ];

    const resourceTypeArb = fc.constantFrom(...unsupportedResourceTypes);

    const resourceArb = fc.record({
      Type: resourceTypeArb,
      Properties: fc.dictionary(fc.string(), fc.anything()),
    });

    const templateArb = fc.record({
      Resources: fc.dictionary(
        fc.string().filter(s => s.length > 0),
        resourceArb,
        { minKeys: 1, maxKeys: 5 }
      ),
    });

    fc.assert(
      fc.property(templateArb, (template) => {
        const content = JSON.stringify(template);
        const result = parser.parse(content);
        
        expect(result).toBeDefined();
        expect(result.Resources).toBeDefined();
        expect(Object.keys(result.Resources).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
