export interface SynthesisOptions {
  cdkAppPath: string;
  outputPath?: string;
  context?: Record<string, string>;
  customCommand?: string;
}

export interface SynthesisResult {
  success: boolean;
  templatePaths: string[];
  stackNames: string[];
  error?: string;
  duration: number;
}

export class SynthesisError extends Error {
  constructor(
    message: string,
    public cdkOutput: string,
  ) {
    super(message);
    this.name = 'SynthesisError';
  }
}
