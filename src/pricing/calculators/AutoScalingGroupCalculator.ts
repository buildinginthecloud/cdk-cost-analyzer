import { ResourceWithId } from '../../diff/types';
import { ResourceCostCalculator, MonthlyCost, PricingClient } from '../types';
import { normalizeRegion } from '../RegionMapper';

export class AutoScalingGroupCalculator implements ResourceCostCalculator {
  supports(resourceType: string): boolean {
    return resourceType === 'AWS::AutoScaling::AutoScalingGroup';
  }

  async calculateCost(
    resource: ResourceWithId,
    region: string,
    pricingClient: PricingClient,
    templateResources?: ResourceWithId[],
  ): Promise<MonthlyCost> {
    const desiredCapacity = Number(resource.properties.DesiredCapacity) || 1;
    const instanceType = this.resolveInstanceType(resource, templateResources);

    if (!instanceType) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: ['Could not determine instance type from LaunchConfiguration or LaunchTemplate'],
      };
    }

    try {
      const hourlyRate = await pricingClient.getPrice({
        serviceCode: 'AmazonEC2',
        region: normalizeRegion(region),
        filters: [
          { field: 'instanceType', value: instanceType },
          { field: 'operatingSystem', value: 'Linux' },
          { field: 'tenancy', value: 'Shared' },
          { field: 'preInstalledSw', value: 'NA' },
          { field: 'capacitystatus', value: 'Used' },
        ],
      });

      if (hourlyRate === null) {
        return {
          amount: 0,
          currency: 'USD',
          confidence: 'unknown',
          assumptions: [`Pricing data not available for instance type ${instanceType} in region ${region}`],
        };
      }

      const monthlyHours = 730;
      const monthlyCost = hourlyRate * monthlyHours * desiredCapacity;

      return {
        amount: monthlyCost,
        currency: 'USD',
        confidence: 'medium',
        assumptions: [
          `${desiredCapacity} instance(s) of type ${instanceType}`,
          `Assumes ${monthlyHours} hours per month (24/7 operation)`,
          'Assumes Linux OS, shared tenancy, on-demand pricing',
          'Does not include EBS volumes or data transfer costs',
        ],
      };
    } catch (error) {
      return {
        amount: 0,
        currency: 'USD',
        confidence: 'unknown',
        assumptions: [`Failed to fetch pricing: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private resolveInstanceType(
    resource: ResourceWithId,
    templateResources?: ResourceWithId[],
  ): string | null {
    // Try LaunchConfigurationName
    const launchConfigRef = resource.properties.LaunchConfigurationName;
    if (launchConfigRef) {
      const resolved = this.resolveReference(launchConfigRef, templateResources);
      if (resolved && resolved.type === 'AWS::AutoScaling::LaunchConfiguration') {
        const instanceType = resolved.properties.InstanceType as string;
        if (instanceType) return instanceType;
      }
    }

    // Try LaunchTemplate
    const launchTemplate = resource.properties.LaunchTemplate as Record<string, unknown> | undefined;
    if (launchTemplate) {
      const instanceType = this.resolveInstanceTypeFromLaunchTemplate(launchTemplate, templateResources);
      if (instanceType) return instanceType;
    }

    // Try MixedInstancesPolicy
    const mixedPolicy = resource.properties.MixedInstancesPolicy as Record<string, unknown> | undefined;
    if (mixedPolicy) {
      const launchTemplateSpec = mixedPolicy.LaunchTemplate as Record<string, unknown> | undefined;
      if (launchTemplateSpec) {
        const ltSpec = launchTemplateSpec.LaunchTemplateSpecification as Record<string, unknown> | undefined;
        if (ltSpec) {
          const instanceType = this.resolveInstanceTypeFromLaunchTemplate(ltSpec, templateResources);
          if (instanceType) return instanceType;
        }
      }
    }

    return null;
  }

  private resolveInstanceTypeFromLaunchTemplate(
    launchTemplateRef: Record<string, unknown>,
    templateResources?: ResourceWithId[],
  ): string | null {
    const ref = launchTemplateRef.LaunchTemplateId || launchTemplateRef.LaunchTemplateName;
    if (!ref) return null;

    const resolved = this.resolveReference(ref, templateResources);
    if (resolved && resolved.type === 'AWS::EC2::LaunchTemplate') {
      const launchTemplateData = resolved.properties.LaunchTemplateData as Record<string, unknown> | undefined;
      if (launchTemplateData) {
        return (launchTemplateData.InstanceType as string) || null;
      }
    }
    return null;
  }

  private resolveReference(
    ref: unknown,
    templateResources?: ResourceWithId[],
  ): ResourceWithId | null {
    if (!templateResources) return null;

    // Handle { Ref: 'LogicalId' }
    if (typeof ref === 'object' && ref !== null && 'Ref' in ref) {
      const logicalId = (ref as Record<string, unknown>).Ref as string;
      return templateResources.find(r => r.logicalId === logicalId) || null;
    }

    // Handle string logical ID
    if (typeof ref === 'string') {
      return templateResources.find(r => r.logicalId === ref) || null;
    }

    return null;
  }
}
