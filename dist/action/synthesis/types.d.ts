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
export declare class SynthesisError extends Error {
    cdkOutput: string;
    constructor(message: string, cdkOutput: string);
}
