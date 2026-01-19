import { Logger } from '../../src/utils/Logger';

describe('Logger', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    Logger.setDebugEnabled(false);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('setDebugEnabled and isDebugEnabled', () => {
    it('should enable debug logging', () => {
      Logger.setDebugEnabled(true);
      expect(Logger.isDebugEnabled()).toBe(true);
    });

    it('should disable debug logging', () => {
      Logger.setDebugEnabled(false);
      expect(Logger.isDebugEnabled()).toBe(false);
    });
  });

  describe('debug', () => {
    it('should not log when debug is disabled', () => {
      Logger.setDebugEnabled(false);
      Logger.debug('test message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log when debug is enabled', () => {
      Logger.setDebugEnabled(true);
      Logger.debug('test message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
    });

    it('should log with data when provided', () => {
      Logger.setDebugEnabled(true);
      const data = { key: 'value' };
      Logger.debug('test message', data);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"key"'));
    });
  });

  describe('logPricingQuery', () => {
    it('should not log when debug is disabled', () => {
      Logger.setDebugEnabled(false);
      Logger.logPricingQuery('AWSLambda', 'US East (N. Virginia)', [
        { field: 'group', value: 'AWS-Lambda-Requests' },
      ]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log pricing query details when enabled', () => {
      Logger.setDebugEnabled(true);
      Logger.logPricingQuery('AWSLambda', 'US East (N. Virginia)', [
        { field: 'group', value: 'AWS-Lambda-Requests' },
      ]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Pricing API Query'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('AWSLambda'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('US East (N. Virginia)'));
    });
  });

  describe('logPricingResponse', () => {
    it('should not log when debug is disabled', () => {
      Logger.setDebugEnabled(false);
      Logger.logPricingResponse('AWSLambda', 'US East (N. Virginia)', 0.2);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log pricing response when enabled', () => {
      Logger.setDebugEnabled(true);
      Logger.logPricingResponse('AWSLambda', 'US East (N. Virginia)', 0.2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Pricing API Response'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('0.2'));
    });

    it('should log null price', () => {
      Logger.setDebugEnabled(true);
      Logger.logPricingResponse('AWSLambda', 'US East (N. Virginia)', null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Pricing API Response'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('null'));
    });
  });

  describe('logRegionNormalization', () => {
    it('should not log when debug is disabled', () => {
      Logger.setDebugEnabled(false);
      Logger.logRegionNormalization('us-east-1', 'US East (N. Virginia)');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log region normalization when enabled', () => {
      Logger.setDebugEnabled(true);
      Logger.logRegionNormalization('us-east-1', 'US East (N. Virginia)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Region Normalization'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('us-east-1'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('US East (N. Virginia)'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('true'));
    });

    it('should indicate when no normalization occurred', () => {
      Logger.setDebugEnabled(true);
      Logger.logRegionNormalization('us-east-1', 'us-east-1');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Region Normalization'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('false'));
    });
  });

  describe('logPricingFailure', () => {
    it('should not log when debug is disabled', () => {
      Logger.setDebugEnabled(false);
      Logger.logPricingFailure('AWSLambda', 'US East (N. Virginia)', 'No products found');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log pricing failure when enabled', () => {
      Logger.setDebugEnabled(true);
      Logger.logPricingFailure('AWSLambda', 'US East (N. Virginia)', 'No products found');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Pricing Lookup Failed'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No products found'));
    });
  });

  describe('logCacheStatus', () => {
    it('should not log when debug is disabled', () => {
      Logger.setDebugEnabled(false);
      Logger.logCacheStatus('test-key', true, 'memory');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log cache hit', () => {
      Logger.setDebugEnabled(true);
      Logger.logCacheStatus('test-key', true, 'memory');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cache HIT'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('memory'));
    });

    it('should log cache miss', () => {
      Logger.setDebugEnabled(true);
      Logger.logCacheStatus('test-key', false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cache MISS'));
    });
  });
});
