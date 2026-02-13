import { SynthesisOptions, SynthesisResult } from './types';
export declare class SynthesisOrchestrator {
    private readonly DEFAULT_OUTPUT_PATH;
    /**
     * Execute CDK synthesis
     */
    synthesize(options: SynthesisOptions): Promise<SynthesisResult>;
    /**
     * Execute synthesis command
     *
     * Uses shell: false for security to prevent command injection attacks.
     * Arguments are passed as an array to avoid shell interpretation.
     *
     * Implements a 15-second timeout to prevent hanging processes in CI:
     * - Sends SIGTERM for graceful termination
     * - Follows up with SIGKILL after 1 second if process doesn't exit
     * - Prevents duplicate resolution using isResolved flag
     * - Ensures all event listeners are cleaned up
     * - Uses process.kill as fallback for stubborn processes
     */
    private executeSynthesis;
    /**
     * Find all CloudFormation templates in output directory
     */
    private findTemplates;
}
