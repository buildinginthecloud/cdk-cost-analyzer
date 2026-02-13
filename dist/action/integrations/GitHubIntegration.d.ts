import { GitHubIntegration as IGitHubIntegration, GitHubConfig, GitHubComment, CommentStrategy } from './types';
export declare class GitHubIntegration implements IGitHubIntegration {
    /**
     * Create a GitHubIntegration instance from environment variables.
     * Looks for GITHUB_TOKEN environment variable.
     */
    static fromEnvironment(): GitHubIntegration;
    private config;
    constructor(config: GitHubConfig);
    /**
     * Post a comment to a pull request using the specified strategy.
     */
    postPRComment(owner: string, repo: string, prNumber: number, comment: string, strategy?: CommentStrategy): Promise<void>;
    /**
     * Find an existing cost analyzer comment on a PR.
     * Supports pagination for PRs with many comments.
     */
    findExistingComment(owner: string, repo: string, prNumber: number): Promise<GitHubComment | null>;
    /**
     * Update an existing comment.
     */
    updateComment(owner: string, repo: string, commentId: number, comment: string): Promise<void>;
    /**
     * Delete a comment.
     */
    deleteComment(owner: string, repo: string, commentId: number): Promise<void>;
    /**
     * Create a new comment on a PR.
     */
    private createComment;
    /**
     * Get headers for GitHub API requests.
     */
    private getHeaders;
    /**
     * Fetch with retry logic for rate limiting.
     */
    private fetchWithRetry;
    /**
     * Sanitize error messages to prevent token leakage.
     */
    private sanitizeError;
}
