// Jest imports are global
import { SageMakerCalculator } from '../../src/pricing/calculators/SageMakerCalculator';
import { PricingClient } from '../../src/pricing/PricingClient';

describe('SageMakerCalculator integration', () => {
  let pricingClient: PricingClient;
  let calculator: SageMakerCalculator;

  beforeAll(() => {
    pricingClient = new PricingClient('us-east-1');
    calculator = new SageMakerCalculator();
  });

  afterAll(() => {
    pricingClient.destroy();
  });

  it('should calculate cost for ml.t3.medium notebook', async () => {
    const resource = {
      logicalId: 'TestNotebook',
      type: 'AWS::SageMaker::NotebookInstance',
      properties: { InstanceType: 'ml.t3.medium' },
    };

    const result = await calculator.calculateCost(resource, 'us-east-1', pricingClient);

    expect(result.amount).toBeGreaterThanOrEqual(0);
    expect(result.currency).toBe('USD');
    expect(['high', 'medium']).toContain(result.confidence);
  });

  it('should calculate cost for SageMaker endpoint (fallback)', async () => {
    const resource = {
      logicalId: 'TestEndpoint',
      type: 'AWS::SageMaker::Endpoint',
      properties: {},
    };

    const result = await calculator.calculateCost(resource, 'us-east-1', pricingClient);

    expect(result.amount).toBeGreaterThan(0);
    expect(result.confidence).toBe('low');
  });
});
