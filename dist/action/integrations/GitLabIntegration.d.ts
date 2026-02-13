import { GitLabIntegration as IGitLabIntegration, GitLabConfig } from './types';
export declare class GitLabIntegration implements IGitLabIntegration {
    static fromEnvironment(): GitLabIntegration;
    private config;
    constructor(config: GitLabConfig);
    postMergeRequestComment(projectId: string, mergeRequestIid: string, comment: string): Promise<void>;
}
