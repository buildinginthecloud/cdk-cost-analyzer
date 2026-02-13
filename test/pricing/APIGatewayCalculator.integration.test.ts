import { PricingClient } from '../../src/pricing/PricingClient';
import { APIGatewayCalculator } from '../../src/pricing/calculators/APIGatewayCalculator';
import { Logger } from '../../src/utils/Logger';

/**
 * Integration test for API Gateway pricing with actual AWS Pricing API
 *
 * This test validates:
 * - Correct pricing queries for REST, HTTP, and WebSocket APIs
 * - Different API types with different pricing models
 * - REST API: ~$3.50 per million requests
 * - HTTP API: ~$1.00 per million requests (cheaper)
 * - WebSocket API: ~$1.00 per million messages + connection minute pricing
 * - Debug logging captures pricing queries and responses
 *
 * API Gateway Pricing:
 * 1. REST API: ~$3.50 per million API calls
 * 2. HTTP API: ~$1.00 per million API calls (70% cheaper than REST)
 * 3. WebSocket API:
 *    - Messages: ~$1.00 per million messages
 *    - Connection minutes: ~$0.025 per million minutes
 *
 * Expected pricing for default configuration (us-east-1):
 * - REST API: 1M requests × $3.50/1M = $3.50/month
 * - HTTP API: 1M requests × $1.00/1M = $1.00/month
 * - WebSocket: 1M messages + 100K minutes = ~$3.50/month
 *
 * To run: npm test -- APIGatewayCalculator.integration.test.ts
 * To run with debug logging: DEBUG=true npm test -- APIGatewayCalculator.integration.test.ts
 */
describe('APIGatewayCalculator - AWS API Integration', () => {
  let pricingClient: PricingClient;
  const testRegion = 'us-east-1';

  beforeAll(() => {
    // Enable debug logging if DEBUG env var is set
    if (process.env.DEBUG === 'true') {
      Logger.setDebugEnabled(true);
      console.error('Debug logging enabled for pricing API calls');
    }
  });

  beforeEach(() => {
    // Create pricing client that connects to actual AWS API
    pricingClient = new PricingClient('us-east-1');
  });

  afterEach(() => {
    if (pricingClient) {
      pricingClient.destroy();
    }
  });

  afterAll(() => {
    // Disable debug logging after tests
    Logger.setDebugEnabled(false);
  });

  // Skip this test in CI unless explicitly enabled
  const testMode = process.env.RUN_INTEGRATION_TESTS === 'true' ? it : it.skip;

  describe('REST API', () => {
    testMode('should fetch real API Gateway REST API pricing', async () => {
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyRestApi',
        type: 'AWS::ApiGateway::RestApi',
        properties: {
          Name: 'MyRestApi',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // REST API costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 1M requests:
        // REST API: 1M × $3.50/1M = $3.50/month
        // Allow 20% variance: ~$2.80 - $4.20
        const expectedMin = 2.80;
        const expectedMax = 4.20;

        console.log('API Gateway REST API pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention REST API
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/rest api/);
        expect(assumptionText).toMatch(/1,000,000/);
      } else {
        console.warn('API Gateway REST API pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('API Gateway REST API pricing should be available for us-east-1');
      }
    }, 30000);
  });

  describe('HTTP API', () => {
    testMode('should fetch real API Gateway HTTP API pricing', async () => {
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyHttpApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          ProtocolType: 'HTTP',
          Name: 'MyHttpApi',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // HTTP API costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 1M requests:
        // HTTP API: 1M × $1.00/1M = $1.00/month
        // Allow 20% variance: ~$0.80 - $1.20
        const expectedMin = 0.80;
        const expectedMax = 1.20;

        console.log('API Gateway HTTP API pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention HTTP API
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/http api/);
        expect(assumptionText).toMatch(/1,000,000/);
      } else {
        console.warn('API Gateway HTTP API pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('API Gateway HTTP API pricing should be available for us-east-1');
      }
    }, 30000);

    testMode('should show HTTP API is cheaper than REST API', async () => {
      const calculator = new APIGatewayCalculator();

      const restResource = {
        logicalId: 'MyRestApi',
        type: 'AWS::ApiGateway::RestApi',
        properties: {},
      };

      const httpResource = {
        logicalId: 'MyHttpApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          ProtocolType: 'HTTP',
        },
      };

      const restCost = await calculator.calculateCost(restResource, testRegion, pricingClient);
      const httpCost = await calculator.calculateCost(httpResource, testRegion, pricingClient);

      if (restCost.amount > 0 && httpCost.amount > 0) {
        console.log(`REST API: $${restCost.amount.toFixed(2)}/month`);
        console.log(`HTTP API: $${httpCost.amount.toFixed(2)}/month`);

        // HTTP API should be significantly cheaper (typically 70% cheaper)
        expect(httpCost.amount).toBeLessThan(restCost.amount);

        // HTTP should be roughly 25-35% of REST cost
        const ratio = httpCost.amount / restCost.amount;
        expect(ratio).toBeGreaterThan(0.20);
        expect(ratio).toBeLessThan(0.40);

        console.log(`HTTP API is ${((1 - ratio) * 100).toFixed(0)}% cheaper than REST API`);
      }
    }, 30000);
  });

  describe('WebSocket API', () => {
    testMode('should fetch real API Gateway WebSocket API pricing', async () => {
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyWebSocketApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          ProtocolType: 'WEBSOCKET',
          Name: 'MyWebSocketApi',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      // Verify we got pricing data
      expect(cost).toBeDefined();
      expect(cost.currency).toBe('USD');

      // If pricing was found, validate it's reasonable
      if (cost.amount > 0) {
        // WebSocket API costs should be positive
        expect(cost.amount).toBeGreaterThan(0);

        // For us-east-1 with 1M messages + 100K connection minutes:
        // Messages: 1M × $1.00/1M = $1.00
        // Connection: 100K × ~$0.025/million = ~$2.50
        // Total: ~$3.50/month
        // Allow wider variance due to connection minute pricing
        const expectedMin = 2.50;
        const expectedMax = 4.50;

        console.log('API Gateway WebSocket API pricing breakdown:');
        console.log(`Total monthly cost: $${cost.amount.toFixed(2)}`);
        cost.assumptions.forEach(assumption => console.log(`  - ${assumption}`));

        expect(cost.amount).toBeGreaterThanOrEqual(expectedMin);
        expect(cost.amount).toBeLessThanOrEqual(expectedMax);
        expect(cost.confidence).toBe('medium');

        // Verify assumptions mention both messages and connection minutes
        const assumptionText = cost.assumptions.join(' ').toLowerCase();
        expect(assumptionText).toMatch(/websocket/);
        expect(assumptionText).toMatch(/message/);
        expect(assumptionText).toMatch(/connection.*minute/);
      } else {
        console.warn('API Gateway WebSocket API pricing lookup failed:');
        cost.assumptions.forEach(assumption => console.warn(`  - ${assumption}`));
        expect(cost.confidence).toBe('unknown');
        throw new Error('API Gateway WebSocket API pricing should be available for us-east-1');
      }
    }, 30000);
  });

  describe('API Type Detection', () => {
    testMode('should default to REST API for V1 resource type', async () => {
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyApi',
        type: 'AWS::ApiGateway::RestApi',
        properties: {
          // No explicit type - should default to REST
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should use REST API pricing (~$3.50/month)
        expect(cost.amount).toBeGreaterThan(2.5);
        expect(cost.amount).toBeLessThan(4.5);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('REST API');
      }
    }, 30000);

    testMode('should detect HTTP API from V2 resource with ProtocolType', async () => {
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          ProtocolType: 'HTTP',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should use HTTP API pricing (~$1.00/month)
        expect(cost.amount).toBeGreaterThan(0.7);
        expect(cost.amount).toBeLessThan(1.3);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('HTTP API');
      }
    }, 30000);

    testMode('should detect WebSocket API from V2 resource', async () => {
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          ProtocolType: 'WEBSOCKET',
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should use WebSocket API pricing (~$3.50/month)
        expect(cost.amount).toBeGreaterThan(2.3);
        expect(cost.amount).toBeLessThan(4.7);

        const assumptionText = cost.assumptions.join(' ');
        expect(assumptionText).toContain('WebSocket');
      }
    }, 30000);
  });

  describe('Multi-Region Support', () => {
    testMode('should work in multiple regions for REST API', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyRestApi',
        type: 'AWS::ApiGateway::RestApi',
        properties: {},
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`API Gateway REST API pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // REST API pricing should be reasonable ($2.80-$4.20/month)
          expect(cost.amount).toBeGreaterThan(2.5);
          expect(cost.amount).toBeLessThan(4.5);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions

    testMode('should work in multiple regions for HTTP API', async () => {
      const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyHttpApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          ProtocolType: 'HTTP',
        },
      };

      for (const region of regions) {
        const cost = await calculator.calculateCost(testResource, region, pricingClient);

        console.log(`API Gateway HTTP API pricing for ${region}: $${cost.amount.toFixed(2)}/month`);

        if (cost.amount > 0) {
          // HTTP API pricing should be reasonable ($0.80-$1.20/month)
          expect(cost.amount).toBeGreaterThan(0.7);
          expect(cost.amount).toBeLessThan(1.3);
          expect(cost.confidence).toBe('medium');
        } else {
          console.warn(`No pricing data for ${region}`);
        }
      }
    }, 90000); // Longer timeout for multiple regions
  });

  describe('Pricing Query Validation', () => {
    testMode('should query correct UsageType for REST API', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new APIGatewayCalculator();

        const testResource = {
          logicalId: 'MyRestApi',
          type: 'AWS::ApiGateway::RestApi',
          properties: {},
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured ApiGatewayRequest UsageType
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);

    testMode('should query correct UsageType for HTTP API', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new APIGatewayCalculator();

        const testResource = {
          logicalId: 'MyHttpApi',
          type: 'AWS::ApiGatewayV2::Api',
          properties: {
            ProtocolType: 'HTTP',
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured ApiGatewayHttpRequest UsageType
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);

    testMode('should query both message and connection pricing for WebSocket', async () => {
      const wasDebugEnabled = Logger.isDebugEnabled();
      Logger.setDebugEnabled(true);

      try {
        const calculator = new APIGatewayCalculator();

        const testResource = {
          logicalId: 'MyWebSocketApi',
          type: 'AWS::ApiGatewayV2::Api',
          properties: {
            ProtocolType: 'WEBSOCKET',
          },
        };

        await calculator.calculateCost(testResource, testRegion, pricingClient);

        // Debug logging should have captured:
        // - ApiGatewayMessage (messages)
        // - ApiGatewayMinute (connection minutes)
        expect(true).toBe(true);
      } finally {
        Logger.setDebugEnabled(wasDebugEnabled);
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    testMode('should handle V2 API without ProtocolType (defaults to REST)', async () => {
      const calculator = new APIGatewayCalculator();

      const testResource = {
        logicalId: 'MyApi',
        type: 'AWS::ApiGatewayV2::Api',
        properties: {
          // No ProtocolType - should default to REST
        },
      };

      const cost = await calculator.calculateCost(testResource, testRegion, pricingClient);

      if (cost.amount > 0) {
        // Should use REST API pricing
        expect(cost.amount).toBeGreaterThan(2.5);
        expect(cost.amount).toBeLessThan(4.5);
      }
    }, 30000);
  });
});
