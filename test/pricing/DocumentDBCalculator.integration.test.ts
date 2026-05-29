// Jest imports are global
import { DocumentDBCalculator } from '../../src/pricing/calculators/DocumentDBCalculator';
import { PricingClient } from '../../src/pricing/PricingClient';

describe('DocumentDBCalculator integration', () => {
  let pricingClient: PricingClient;
  let calculator: DocumentDBCalculator;

  beforeAll(() => {
    pricingClient = new PricingClient('us-east-1');
    calculator = new DocumentDBCalculator();
  });

  afterAll(() => {
    pricingClient.destroy();
  });

  it('should calculate cost for db.r6g.large', async () => {
    const resource = {
      logicalId: 'TestDocDB',
      type: 'AWS::DocDB::DBInstance',
      properties: { DBInstanceClass: 'db.r6g.large' },
    };

    const result = await calculator.calculateCost(resource, 'us-east-1', pricingClient);

    expect(result.amount).toBeGreaterThanOrEqual(0);
    expect(result.currency).toBe('USD');
    expect(['high', 'medium']).toContain(result.confidence);
  });

  it('should return $0 for DBCluster', async () => {
    const resource = {
      logicalId: 'TestDocDBCluster',
      type: 'AWS::DocDB::DBCluster',
      properties: {},
    };

    const result = await calculator.calculateCost(resource, 'us-east-1', pricingClient);
    expect(result.amount).toBe(0);
    expect(result.confidence).toBe('high');
  });
});
