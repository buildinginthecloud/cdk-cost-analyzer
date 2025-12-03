import * as yaml from 'js-yaml';
import { CloudFormationTemplate, TemplateParser as ITemplateParser } from './types';

export class TemplateParseError extends Error {
  constructor(message: string, public templatePath?: string) {
    super(message);
    this.name = 'TemplateParseError';
  }
}

export class TemplateParser implements ITemplateParser {
  parse(content: string): CloudFormationTemplate {
    if (!content || content.trim() === '') {
      throw new TemplateParseError('Template content is empty');
    }

    let template: unknown;

    try {
      template = JSON.parse(content);
    } catch (jsonError) {
      try {
        template = yaml.load(content);
      } catch (yamlError) {
        throw new TemplateParseError(
          `Failed to parse template as JSON or YAML: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`
        );
      }
    }

    if (!template || typeof template !== 'object') {
      throw new TemplateParseError('Parsed template is not an object');
    }

    const parsedTemplate = template as Partial<CloudFormationTemplate>;

    if (!parsedTemplate.Resources || typeof parsedTemplate.Resources !== 'object') {
      throw new TemplateParseError('Template must contain a Resources section');
    }

    return parsedTemplate as CloudFormationTemplate;
  }
}
