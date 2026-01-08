import * as fc from 'fast-check';
// Jest imports are global
import { DiffEngine } from '../../src/diff/DiffEngine';
import { CloudFormationTemplate } from '../../src/parser/types';

describe('DiffEngine - Property Tests', () => {
  const engine = new DiffEngine();

  // Feature: cdk-cost-analyzer, Property 2: Diff engine correctly categorizes resources
  it('should correctly categorize all added, removed, and modified resources', () => {
    const resourceTypeArb = fc.constantFrom(
      'AWS::S3::Bucket',
      'AWS::EC2::Instance',
      'AWS::Lambda::Function',
    );

    const resourceArb = fc.record({
      Type: resourceTypeArb,
      Properties: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer())),
    });

    fc.assert(
      fc.property(
        fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 5 }),
        fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 5 }),
        (baseResources, targetResources) => {
          const base: CloudFormationTemplate = { Resources: baseResources };
          const target: CloudFormationTemplate = { Resources: targetResources };

          const diff = engine.diff(base, target);

          const baseIds = new Set(Object.keys(baseResources));
          const targetIds = new Set(Object.keys(targetResources));

          // Verify added resources (in target but not in base)
          const expectedAdded = [...targetIds].filter(id => !baseIds.has(id));
          expect(diff.added.map(r => r.logicalId).sort()).toEqual(expectedAdded.sort());

          // Verify removed resources (in base but not in target)
          const expectedRemoved = [...baseIds].filter(id => !targetIds.has(id));
          expect(diff.removed.map(r => r.logicalId).sort()).toEqual(expectedRemoved.sort());

          // Verify modified resources (in both but with different properties)
          const commonIds = [...baseIds].filter(id => targetIds.has(id));
          diff.modified.forEach(resource => {
            expect(commonIds).toContain(resource.logicalId);
            expect(baseResources[resource.logicalId]).toBeDefined();
            expect(targetResources[resource.logicalId]).toBeDefined();
          });

          // Verify added resources have correct type and properties
          diff.added.forEach(resource => {
            expect(targetResources[resource.logicalId]).toBeDefined();
            expect(resource.type).toBe(targetResources[resource.logicalId].Type);
            expect(resource.properties).toEqual(targetResources[resource.logicalId].Properties || {});
          });

          // Verify removed resources have correct type and properties
          diff.removed.forEach(resource => {
            expect(baseResources[resource.logicalId]).toBeDefined();
            expect(resource.type).toBe(baseResources[resource.logicalId].Type);
            expect(resource.properties).toEqual(baseResources[resource.logicalId].Properties || {});
          });

          // Verify modified resources have correct old and new properties
          diff.modified.forEach(resource => {
            expect(resource.oldProperties).toEqual(baseResources[resource.logicalId].Properties || {});
            expect(resource.newProperties).toEqual(targetResources[resource.logicalId].Properties || {});
            // Ensure properties actually differ
            expect(JSON.stringify(resource.oldProperties)).not.toBe(JSON.stringify(resource.newProperties));
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: cdk-cost-analyzer, Property 5: Resources appear in exactly one category
  it('should place each resource in exactly one category', () => {
    const resourceArb = fc.record({
      Type: fc.constantFrom('AWS::S3::Bucket', 'AWS::EC2::Instance'),
      Properties: fc.dictionary(fc.string(), fc.string()),
    });

    fc.assert(
      fc.property(
        fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 10 }),
        fc.dictionary(fc.string().filter(s => s.length > 0 && s.trim().length > 0), resourceArb, { minKeys: 1, maxKeys: 10 }),
        (baseResources, targetResources) => {
          const base: CloudFormationTemplate = { Resources: baseResources };
          const target: CloudFormationTemplate = { Resources: targetResources };

          const diff = engine.diff(base, target);

          const addedIds = new Set(diff.added.map(r => r.logicalId));
          const removedIds = new Set(diff.removed.map(r => r.logicalId));
          const modifiedIds = new Set(diff.modified.map(r => r.logicalId));

          addedIds.forEach(id => {
            expect(removedIds.has(id)).toBe(false);
            expect(modifiedIds.has(id)).toBe(false);
          });

          removedIds.forEach(id => {
            expect(addedIds.has(id)).toBe(false);
            expect(modifiedIds.has(id)).toBe(false);
          });

          modifiedIds.forEach(id => {
            expect(addedIds.has(id)).toBe(false);
            expect(removedIds.has(id)).toBe(false);
          });

          const allDiffIds = new Set([...addedIds, ...removedIds, ...modifiedIds]);
          const allResourceIds = new Set([
            ...Object.keys(baseResources),
            ...Object.keys(targetResources),
          ]);

          allDiffIds.forEach(id => {
            expect(allResourceIds.has(id)).toBe(true);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
