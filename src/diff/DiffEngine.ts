import { DiffEngine as IDiffEngine, ResourceDiff, ResourceWithId, ModifiedResource } from './types';
import { CloudFormationTemplate } from '../parser/types';

export class DiffEngine implements IDiffEngine {
  diff(base: CloudFormationTemplate, target: CloudFormationTemplate): ResourceDiff {
    const baseResources = base.Resources || {};
    const targetResources = target.Resources || {};

    const baseIds = new Set(Object.keys(baseResources));
    const targetIds = new Set(Object.keys(targetResources));

    const added: ResourceWithId[] = [];
    const removed: ResourceWithId[] = [];
    const modified: ModifiedResource[] = [];

    for (const logicalId of targetIds) {
      if (!baseIds.has(logicalId)) {
        const resource = targetResources[logicalId];
        added.push({
          logicalId,
          type: resource.Type,
          properties: resource.Properties || {},
        });
      }
    }

    for (const logicalId of baseIds) {
      if (!targetIds.has(logicalId)) {
        const resource = baseResources[logicalId];
        removed.push({
          logicalId,
          type: resource.Type,
          properties: resource.Properties || {},
        });
      }
    }

    for (const logicalId of baseIds) {
      if (targetIds.has(logicalId)) {
        const baseResource = baseResources[logicalId];
        const targetResource = targetResources[logicalId];

        if (!this.arePropertiesEqual(baseResource.Properties, targetResource.Properties)) {
          modified.push({
            logicalId,
            type: targetResource.Type,
            oldProperties: baseResource.Properties || {},
            newProperties: targetResource.Properties || {},
          });
        }
      }
    }

    return { added, removed, modified };
  }

  private arePropertiesEqual(
    props1: Record<string, unknown> | undefined,
    props2: Record<string, unknown> | undefined,
  ): boolean {
    const p1 = props1 || {};
    const p2 = props2 || {};

    return JSON.stringify(this.sortObject(p1)) === JSON.stringify(this.sortObject(p2));
  }

  private sortObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    if (typeof obj === 'object') {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(obj as Record<string, unknown>).sort();
      for (const key of keys) {
        sorted[key] = this.sortObject((obj as Record<string, unknown>)[key]);
      }
      return sorted;
    }

    return obj;
  }
}
