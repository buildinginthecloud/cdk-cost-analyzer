import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from '../../src/config/ConfigManager';
import { CostAnalyzerConfig } from '../../src/config/types';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    configManager = new ConfigManager();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config: CostAnalyzerConfig = {
        thresholds: {
          default: {
            warning: 50,
            error: 100,
          },
        },
      };

      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative threshold values', () => {
      const config: CostAnalyzerConfig = {
        thresholds: {
          default: {
            warning: -10,
            error: 100,
          },
        },
      };

      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('thresholds.default.warning must be non-negative');
    });

    it('should warn when warning threshold exceeds error threshold', () => {
      const config: CostAnalyzerConfig = {
        thresholds: {
          default: {
            warning: 200,
            error: 100,
          },
        },
      };

      const result = configManager.validateConfig(config);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject negative usage assumptions', () => {
      const config: CostAnalyzerConfig = {
        usageAssumptions: {
          s3: {
            storageGB: -10,
          },
        },
      };

      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('usageAssumptions.s3.storageGB must be non-negative');
    });

    it('should reject non-positive cache duration', () => {
      const config: CostAnalyzerConfig = {
        cache: {
          enabled: true,
          durationHours: 0,
        },
      };

      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cache.durationHours must be positive');
    });
  });

  describe('loadConfig', () => {
    it('should return default config when no file exists', async () => {
      const config = await configManager.loadConfig();

      expect(config).toBeDefined();
      expect(config.cache).toBeDefined();
      expect(config.cache?.enabled).toBe(true);
      expect(config.cache?.durationHours).toBe(24);
    });

    it('should merge user config with defaults', async () => {
      const userConfig: CostAnalyzerConfig = {
        thresholds: {
          default: {
            warning: 50,
          },
        },
      };

      const configPath = path.join(tempDir, '.cdk-cost-analyzer.json');
      await fs.writeFile(configPath, JSON.stringify(userConfig));

      const config = await configManager.loadConfig(configPath);

      expect(config.thresholds).toBeDefined();
      expect(config.thresholds?.default?.warning).toBe(50);
      expect(config.cache?.enabled).toBe(true); // From defaults
    });
  });
});
