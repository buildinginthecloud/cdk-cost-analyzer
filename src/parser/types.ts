export interface CloudFormationTemplate {
  AWSTemplateFormatVersion?: string;
  Description?: string;
  Metadata?: Record<string, unknown>;
  Parameters?: Record<string, Parameter>;
  Resources: Record<string, Resource>;
  Outputs?: Record<string, Output>;
}

export interface Resource {
  Type: string;
  Properties: Record<string, unknown>;
  DependsOn?: string | string[];
  Metadata?: Record<string, unknown>;
}

export interface Parameter {
  Type: string;
  Default?: unknown;
  Description?: string;
  AllowedValues?: unknown[];
}

export interface Output {
  Value: unknown;
  Description?: string;
  Export?: {
    Name: string;
  };
}

export interface TemplateParser {
  parse(content: string): CloudFormationTemplate;
}
