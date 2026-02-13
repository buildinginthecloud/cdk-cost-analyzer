import { DiffEngine as IDiffEngine, ResourceDiff } from './types';
import { CloudFormationTemplate } from '../parser/types';
export declare class DiffEngine implements IDiffEngine {
    diff(base: CloudFormationTemplate, target: CloudFormationTemplate): ResourceDiff;
    private arePropertiesEqual;
    private sortObject;
}
