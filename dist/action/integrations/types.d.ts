export interface GitLabIntegration {
    postMergeRequestComment(projectId: string, mergeRequestIid: string, comment: string): Promise<void>;
}
export interface GitLabConfig {
    token: string;
    apiUrl: string;
}
export declare class GitLabAPIError extends Error {
    statusCode?: number | undefined;
    constructor(message: string, statusCode?: number | undefined);
}
/**
 * Comment strategy for GitHub PR comments
 * - 'new': Always create a new comment
 * - 'update': Find and update existing comment, or create new if not found
 * - 'delete-and-new': Delete existing comment and create a new one
 */
export type CommentStrategy = 'new' | 'update' | 'delete-and-new';
export interface GitHubIntegration {
    postPRComment(owner: string, repo: string, prNumber: number, comment: string, strategy: CommentStrategy): Promise<void>;
    findExistingComment(owner: string, repo: string, prNumber: number): Promise<GitHubComment | null>;
    updateComment(owner: string, repo: string, commentId: number, comment: string): Promise<void>;
    deleteComment(owner: string, repo: string, commentId: number): Promise<void>;
}
export interface GitHubConfig {
    token: string;
    apiUrl: string;
}
export interface GitHubComment {
    id: number;
    body: string;
    user: {
        login: string;
        type: string;
    };
}
export declare class GitHubAPIError extends Error {
    statusCode?: number | undefined;
    constructor(message: string, statusCode?: number | undefined);
}
