// Jest imports are global
import { NeptuneCalculator } from '../../src/pricing/calculators/NeptuneCalculator';
import { PricingClient } from '../../src/pricing/PricingClient';

describe('NeptuneCalculator integration', () => {
  let pricingClient: PricingClient;
  let calculator: NeptuneCalculator;

  beforeAll(() => {
    pricingClient = new PricingClient('us-east-1');
    calculator = new NeptuneCalculator();
  });

  afterAll(() => {
    pricingClient.destroy();
  });

  it('should calculate cost for db.r5.large', async () => {
    const resource = {
      logicalId: 'TestNeptune',
      type: 'AWS::Neptune::DBInstance',
      properties: { DBInstanceClass: 'db.r5.large' },
    };

    const result = await calculator.calculateCost(resource, 'us-east-1', pricingClient);

    expect(result.amount).toBeGreaterThanOrEqual(0);
    expect(result.currency).toBe('USD');
    expect(['high', 'medium']).toContain(result.confidence);
  });

  it('should return $0 for DBCluster', async () => {
    const resource = {
      logicalId: 'TestNeptuneCluster',
      type: 'AWS::Neptune::DBCluster',
      properties: {},
    };

    const result = await calculator.calculateCost(resource, 'us-east-1', pricingClient);
    expect(result.amount).toBe(0);
    expect(result.confidence).toBe('high');
  });
});
