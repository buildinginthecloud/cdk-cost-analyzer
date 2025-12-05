import { describe, it, expect } from 'vitest';
import { TemplateParser, TemplateParseError } from '../../src/parser/TemplateParser';

describe('TemplateParser', () => {
  const parser = new TemplateParser();

  describe('JSON parsing', () => {
    it('should parse valid JSON template', () => {
      const template = JSON.stringify({
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {}
          }
        }
      });

      const result = parser.parse(template);
      expect(result.Resources).toBeDefined();
      expect(result.Resources.MyBucket).toBeDefined();
      expect(result.Resources.MyBucket.Type).toBe('AWS::S3::Bucket');
    });

    it('should parse JSON template with all sections', () => {
      const template = JSON.stringify({
        AWSTemplateFormatVersion: '2010-09-09',
        Description: 'Test template',
        Resources: {
          MyInstance: {
            Type: 'AWS::EC2::Instance',
            Properties: {
              InstanceType: 't3.micro'
            }
          }
        },
        Outputs: {
          InstanceId: {
            Value: { Ref: 'MyInstance' }
          }
        }
      });

      const result = parser.parse(template);
      expect(result.AWSTemplateFormatVersion).toBe('2010-09-09');
      expect(result.Description).toBe('Test template');
      expect(result.Resources).toBeDefined();
      expect(result.Outputs).toBeDefined();
    });
  });

  describe('YAML parsing', () => {
    it('should parse valid YAML template', () => {
      const template = `
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-test-bucket
`;

      const result = parser.parse(template);
      expect(result.Resources).toBeDefined();
      expect(result.Resources.MyBucket).toBeDefined();
      expect(result.Resources.MyBucket.Type).toBe('AWS::S3::Bucket');
    });

    it('should parse YAML template with all sections', () => {
      const template = `
AWSTemplateFormatVersion: '2010-09-09'
Description: Test template
Resources:
  MyFunction:
    Type: AWS::Lambda::Function
    Properties:
      Runtime: nodejs18.x
      Handler: index.handler
Outputs:
  FunctionArn:
    Value:
      Fn::GetAtt:
        - MyFunction
        - Arn
`;

      const result = parser.parse(template);
      expect(result.AWSTemplateFormatVersion).toBe('2010-09-09');
      expect(result.Description).toBe('Test template');
      expect(result.Resources.MyFunction).toBeDefined();
      expect(result.Outputs).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error for empty template', () => {
      expect(() => parser.parse('')).toThrow(TemplateParseError);
      expect(() => parser.parse('  ')).toThrow(TemplateParseError);
    });

    it('should throw error for malformed JSON', () => {
      expect(() => parser.parse('{ invalid json')).toThrow(TemplateParseError);
    });

    it('should throw error for malformed YAML', () => {
      expect(() => parser.parse('invalid: yaml: content: [')).toThrow(TemplateParseError);
    });

    it('should throw error for template without Resources section', () => {
      const template = JSON.stringify({
        AWSTemplateFormatVersion: '2010-09-09',
        Description: 'Test template'
      });

      expect(() => parser.parse(template)).toThrow(TemplateParseError);
      expect(() => parser.parse(template)).toThrow('Resources section');
    });

    it('should throw error for non-object template', () => {
      expect(() => parser.parse('null')).toThrow(TemplateParseError);
      expect(() => parser.parse('"string"')).toThrow(TemplateParseError);
      expect(() => parser.parse('123')).toThrow(TemplateParseError);
    });
  });
});
