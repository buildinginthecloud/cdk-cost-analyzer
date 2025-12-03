import { CloudFormationTemplate, Resource } from '../parser/types';

export interface DiffEngine {
  diff(base: CloudFormationTemplate, target: CloudFormationTemplate): ResourceDiff;
}

export interface ResourceDiff {
  added: ResourceWithId[];
  removed: ResourceWithId[];
  modified: ModifiedResource[];
}

export interface ResourceWithId {
  logicalId: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface ModifiedResource {
  logicalId: string;
  type: string;
  oldProperties: Record<string, unknown>;
  newProperties: Record<string, unknown>;
}
