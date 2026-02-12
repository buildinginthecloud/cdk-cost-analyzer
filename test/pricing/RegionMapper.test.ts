import { normalizeRegion, getRegionPrefix } from '../../src/pricing/RegionMapper';

describe('RegionMapper', () => {
  describe('normalizeRegion', () => {
    it('returns human-readable name for known US regions', () => {
      expect(normalizeRegion('us-east-1')).toBe('US East (N. Virginia)');
      expect(normalizeRegion('us-east-2')).toBe('US East (Ohio)');
      expect(normalizeRegion('us-west-1')).toBe('US West (N. California)');
      expect(normalizeRegion('us-west-2')).toBe('US West (Oregon)');
    });

    it('returns human-readable name for known EU regions', () => {
      expect(normalizeRegion('eu-west-1')).toBe('EU (Ireland)');
      expect(normalizeRegion('eu-west-2')).toBe('EU (London)');
      expect(normalizeRegion('eu-central-1')).toBe('EU (Frankfurt)');
      expect(normalizeRegion('eu-north-1')).toBe('EU (Stockholm)');
    });

    it('returns human-readable name for known AP regions', () => {
      expect(normalizeRegion('ap-northeast-1')).toBe('Asia Pacific (Tokyo)');
      expect(normalizeRegion('ap-southeast-1')).toBe('Asia Pacific (Singapore)');
      expect(normalizeRegion('ap-south-1')).toBe('Asia Pacific (Mumbai)');
    });

    it('returns the original region code for unknown regions', () => {
      expect(normalizeRegion('unknown-region-1')).toBe('unknown-region-1');
      expect(normalizeRegion('test-region')).toBe('test-region');
    });
  });

  describe('getRegionPrefix', () => {
    describe('US regions', () => {
      it('returns correct prefix for us-east-1', () => {
        expect(getRegionPrefix('us-east-1')).toBe('USE1');
      });

      it('returns correct prefix for us-east-2', () => {
        expect(getRegionPrefix('us-east-2')).toBe('USE2');
      });

      it('returns correct prefix for us-west-1', () => {
        expect(getRegionPrefix('us-west-1')).toBe('USW1');
      });

      it('returns correct prefix for us-west-2', () => {
        expect(getRegionPrefix('us-west-2')).toBe('USW2');
      });
    });

    describe('EU regions', () => {
      it('returns correct prefix for eu-west-1', () => {
        expect(getRegionPrefix('eu-west-1')).toBe('EUW1');
      });

      it('returns correct prefix for eu-west-2', () => {
        expect(getRegionPrefix('eu-west-2')).toBe('EUW2');
      });

      it('returns correct prefix for eu-west-3', () => {
        expect(getRegionPrefix('eu-west-3')).toBe('EUW3');
      });

      it('returns correct prefix for eu-central-1', () => {
        expect(getRegionPrefix('eu-central-1')).toBe('EUC1');
      });

      it('returns correct prefix for eu-central-2', () => {
        expect(getRegionPrefix('eu-central-2')).toBe('EUC2');
      });

      it('returns correct prefix for eu-north-1', () => {
        expect(getRegionPrefix('eu-north-1')).toBe('EUN1');
      });

      it('returns correct prefix for eu-south-1', () => {
        expect(getRegionPrefix('eu-south-1')).toBe('EUS1');
      });

      it('returns correct prefix for eu-south-2', () => {
        expect(getRegionPrefix('eu-south-2')).toBe('EUS2');
      });
    });

    describe('Asia Pacific regions', () => {
      it('returns correct prefix for ap-south-1 (Mumbai)', () => {
        expect(getRegionPrefix('ap-south-1')).toBe('APS1');
      });

      it('returns correct prefix for ap-south-2 (Hyderabad)', () => {
        expect(getRegionPrefix('ap-south-2')).toBe('APS2');
      });

      it('returns correct prefix for ap-southeast-1 (Singapore)', () => {
        expect(getRegionPrefix('ap-southeast-1')).toBe('APS3');
      });

      it('returns correct prefix for ap-southeast-2 (Sydney)', () => {
        expect(getRegionPrefix('ap-southeast-2')).toBe('APS4');
      });

      it('returns correct prefix for ap-southeast-3 (Jakarta)', () => {
        expect(getRegionPrefix('ap-southeast-3')).toBe('APS5');
      });

      it('returns correct prefix for ap-southeast-4 (Melbourne)', () => {
        expect(getRegionPrefix('ap-southeast-4')).toBe('APS6');
      });

      it('returns correct prefix for ap-southeast-5 (Malaysia)', () => {
        expect(getRegionPrefix('ap-southeast-5')).toBe('APS7');
      });

      it('returns correct prefix for ap-northeast-1 (Tokyo)', () => {
        expect(getRegionPrefix('ap-northeast-1')).toBe('APN1');
      });

      it('returns correct prefix for ap-northeast-2 (Seoul)', () => {
        expect(getRegionPrefix('ap-northeast-2')).toBe('APN2');
      });

      it('returns correct prefix for ap-northeast-3 (Osaka)', () => {
        expect(getRegionPrefix('ap-northeast-3')).toBe('APN3');
      });

      it('returns correct prefix for ap-east-1 (Hong Kong)', () => {
        expect(getRegionPrefix('ap-east-1')).toBe('APE1');
      });
    });

    describe('Canada regions', () => {
      it('returns correct prefix for ca-central-1', () => {
        expect(getRegionPrefix('ca-central-1')).toBe('CAN1');
      });

      it('returns correct prefix for ca-west-1', () => {
        expect(getRegionPrefix('ca-west-1')).toBe('CAW1');
      });
    });

    describe('South America regions', () => {
      it('returns correct prefix for sa-east-1', () => {
        expect(getRegionPrefix('sa-east-1')).toBe('SAE1');
      });
    });

    describe('Middle East regions', () => {
      it('returns correct prefix for me-south-1 (Bahrain)', () => {
        expect(getRegionPrefix('me-south-1')).toBe('MES1');
      });

      it('returns correct prefix for me-central-1 (UAE)', () => {
        expect(getRegionPrefix('me-central-1')).toBe('MEC1');
      });
    });

    describe('Africa regions', () => {
      it('returns correct prefix for af-south-1 (Cape Town)', () => {
        expect(getRegionPrefix('af-south-1')).toBe('AFS1');
      });
    });

    describe('Israel regions', () => {
      it('returns correct prefix for il-central-1 (Tel Aviv)', () => {
        expect(getRegionPrefix('il-central-1')).toBe('ILC1');
      });
    });

    describe('GovCloud regions', () => {
      it('returns correct prefix for us-gov-west-1', () => {
        expect(getRegionPrefix('us-gov-west-1')).toBe('UGW1');
      });

      it('returns correct prefix for us-gov-east-1', () => {
        expect(getRegionPrefix('us-gov-east-1')).toBe('UGE1');
      });
    });

    describe('EU Sovereign Cloud (ISOE) regions', () => {
      it('returns correct prefix for eu-isoe-west-1', () => {
        expect(getRegionPrefix('eu-isoe-west-1')).toBe('EIW1');
      });
    });

    describe('unknown regions', () => {
      it('returns empty string for unknown region', () => {
        expect(getRegionPrefix('unknown-region-1')).toBe('');
      });

      it('returns empty string for empty string input', () => {
        expect(getRegionPrefix('')).toBe('');
      });

      it('returns empty string for invalid region format', () => {
        expect(getRegionPrefix('not-a-region')).toBe('');
        expect(getRegionPrefix('US-EAST-1')).toBe(''); // Case-sensitive
        expect(getRegionPrefix('useast1')).toBe('');
      });
    });

    describe('edge cases', () => {
      it('is case-sensitive', () => {
        expect(getRegionPrefix('US-EAST-1')).toBe('');
        expect(getRegionPrefix('Us-East-1')).toBe('');
        expect(getRegionPrefix('us-east-1')).toBe('USE1');
      });

      it('does not trim whitespace', () => {
        expect(getRegionPrefix(' us-east-1')).toBe('');
        expect(getRegionPrefix('us-east-1 ')).toBe('');
        expect(getRegionPrefix(' us-east-1 ')).toBe('');
      });
    });

    describe('comprehensive region coverage', () => {
      const allExpectedMappings: Record<string, string> = {
        // US Regions
        'us-east-1': 'USE1',
        'us-east-2': 'USE2',
        'us-west-1': 'USW1',
        'us-west-2': 'USW2',
        // EU Regions
        'eu-west-1': 'EUW1',
        'eu-west-2': 'EUW2',
        'eu-west-3': 'EUW3',
        'eu-central-1': 'EUC1',
        'eu-central-2': 'EUC2',
        'eu-north-1': 'EUN1',
        'eu-south-1': 'EUS1',
        'eu-south-2': 'EUS2',
        // Asia Pacific Regions
        'ap-south-1': 'APS1',
        'ap-south-2': 'APS2',
        'ap-southeast-1': 'APS3',
        'ap-southeast-2': 'APS4',
        'ap-southeast-3': 'APS5',
        'ap-southeast-4': 'APS6',
        'ap-southeast-5': 'APS7',
        'ap-northeast-1': 'APN1',
        'ap-northeast-2': 'APN2',
        'ap-northeast-3': 'APN3',
        'ap-east-1': 'APE1',
        // Canada Regions
        'ca-central-1': 'CAN1',
        'ca-west-1': 'CAW1',
        // South America Regions
        'sa-east-1': 'SAE1',
        // Middle East Regions
        'me-south-1': 'MES1',
        'me-central-1': 'MEC1',
        // Africa Regions
        'af-south-1': 'AFS1',
        // Israel Regions
        'il-central-1': 'ILC1',
        // GovCloud Regions
        'us-gov-west-1': 'UGW1',
        'us-gov-east-1': 'UGE1',
        // EU Sovereign Cloud
        'eu-isoe-west-1': 'EIW1',
      };

      it.each(Object.entries(allExpectedMappings))(
        'maps %s to %s',
        (region, expectedPrefix) => {
          expect(getRegionPrefix(region)).toBe(expectedPrefix);
        },
      );
    });
  });
});
