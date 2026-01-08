// Jest imports are global
import { DiffEngine } from '../../src/diff/DiffEngine';
import { CloudFormationTemplate } from '../../src/parser/types';

describe('DiffEngine', () => {
  const engine = new DiffEngine();

  describe('identifying added resources', () => {
    it('should identify resources added in target template', () => {
      const base: CloudFormationTemplate = {
        Resources: {
          ExistingBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
        },
      };

      const target: CloudFormationTemplate = {
        Resources: {
          ExistingBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
          NewBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: { BucketName: 'new-bucket' },
          },
        },
      };

      const diff = engine.diff(base, target);

      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].logicalId).toBe('NewBucket');
      expect(diff.added[0].type).toBe('AWS::S3::Bucket');
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
    });
  });

  describe('identifying removed resources', () => {
    it('should identify resources removed from base template', () => {
      const base: CloudFormationTemplate = {
        Resources: {
          OldBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
          KeptBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
        },
      };

      const target: CloudFormationTemplate = {
        Resources: {
          KeptBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
        },
      };

      const diff = engine.diff(base, target);

      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].logicalId).toBe('OldBucket');
      expect(diff.removed[0].type).toBe('AWS::S3::Bucket');
      expect(diff.added).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
    });
  });

  describe('identifying modified resources', () => {
    it('should identify resources with changed properties', () => {
      const base: CloudFormationTemplate = {
        Resources: {
          MyInstance: {
            Type: 'AWS::EC2::Instance',
            Properties: { InstanceType: 't3.micro' },
          },
        },
      };

      const target: CloudFormationTemplate = {
        Resources: {
          MyInstance: {
            Type: 'AWS::EC2::Instance',
            Properties: { InstanceType: 't3.large' },
          },
        },
      };

      const diff = engine.diff(base, target);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].logicalId).toBe('MyInstance');
      expect(diff.modified[0].type).toBe('AWS::EC2::Instance');
      expect(diff.modified[0].oldProperties.InstanceType).toBe('t3.micro');
      expect(diff.modified[0].newProperties.InstanceType).toBe('t3.large');
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
    });

    it('should not mark resources as modified if properties are identical', () => {
      const base: CloudFormationTemplate = {
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: { BucketName: 'my-bucket' },
          },
        },
      };

      const target: CloudFormationTemplate = {
        Resources: {
          MyBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: { BucketName: 'my-bucket' },
          },
        },
      };

      const diff = engine.diff(base, target);

      expect(diff.modified).toHaveLength(0);
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
    });
  });

  describe('handling identical templates', () => {
    it('should return no changes for identical templates', () => {
      const template: CloudFormationTemplate = {
        Resources: {
          Bucket1: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
          Instance1: {
            Type: 'AWS::EC2::Instance',
            Properties: { InstanceType: 't3.micro' },
          },
        },
      };

      const diff = engine.diff(template, template);

      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
    });
  });

  describe('handling completely different templates', () => {
    it('should identify all resources as added or removed', () => {
      const base: CloudFormationTemplate = {
        Resources: {
          OldResource1: {
            Type: 'AWS::S3::Bucket',
            Properties: {},
          },
          OldResource2: {
            Type: 'AWS::EC2::Instance',
            Properties: {},
          },
        },
      };

      const target: CloudFormationTemplate = {
        Resources: {
          NewResource1: {
            Type: 'AWS::Lambda::Function',
            Properties: {},
          },
          NewResource2: {
            Type: 'AWS::RDS::DBInstance',
            Properties: {},
          },
        },
      };

      const diff = engine.diff(base, target);

      expect(diff.removed).toHaveLength(2);
      expect(diff.added).toHaveLength(2);
      expect(diff.modified).toHaveLength(0);
    });
  });

  describe('deep property comparison', () => {
    it('should detect changes in nested properties', () => {
      const base: CloudFormationTemplate = {
        Resources: {
          MyFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
              Runtime: 'nodejs18.x',
              Environment: {
                Variables: {
                  KEY1: 'value1',
                },
              },
            },
          },
        },
      };

      const target: CloudFormationTemplate = {
        Resources: {
          MyFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
              Runtime: 'nodejs18.x',
              Environment: {
                Variables: {
                  KEY1: 'value2',
                },
              },
            },
          },
        },
      };

      const diff = engine.diff(base, target);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].logicalId).toBe('MyFunction');
    });
  });
});
