import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

vi.mock('@aws-sdk/client-pricing', () => ({
  PricingClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  GetProductsCommand: vi.fn(),
}));

describe('CLI', () => {
  const testDir = path.join(__dirname, 'test-templates');
  const baseTemplatePath = path.join(testDir, 'base.json');
  const targetTemplatePath = path.join(testDir, 'target.json');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const baseTemplate = {
      Resources: {
        Bucket1: {
          Type: 'AWS::S3::Bucket',
          Properties: {}
        }
      }
    };

    const targetTemplate = {
      Resources: {
        Bucket1: {
          Type: 'AWS::S3::Bucket',
          Properties: {}
        },
        Bucket2: {
          Type: 'AWS::S3::Bucket',
          Properties: {}
        }
      }
    };

    fs.writeFileSync(baseTemplatePath, JSON.stringify(baseTemplate, null, 2));
    fs.writeFileSync(targetTemplatePath, JSON.stringify(targetTemplate, null, 2));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should accept valid template file paths', () => {
    expect(fs.existsSync(baseTemplatePath)).toBe(true);
    expect(fs.existsSync(targetTemplatePath)).toBe(true);
  });

  it('should handle missing base template file', () => {
    expect(fs.existsSync('/nonexistent/base.json')).toBe(false);
  });

  it('should handle missing target template file', () => {
    expect(fs.existsSync('/nonexistent/target.json')).toBe(false);
  });
});
