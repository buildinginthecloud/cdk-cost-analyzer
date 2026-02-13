import { CloudFormationTemplate, TemplateParser as ITemplateParser } from './types';
export declare class TemplateParseError extends Error {
    templatePath?: string | undefined;
    constructor(message: string, templatePath?: string | undefined);
}
export declare class TemplateParser implements ITemplateParser {
    parse(content: string): CloudFormationTemplate;
}
