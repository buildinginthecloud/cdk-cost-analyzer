import {
  GitHubIntegration as IGitHubIntegration,
  GitHubConfig,
  GitHubAPIError,
  GitHubComment,
  CommentStrategy,
} from './types';

/** Marker used to identify cost analyzer comments */
const COMMENT_MARKER = '<!-- cdk-cost-analyzer -->';

export class GitHubIntegration implements IGitHubIntegration {
  /**
   * Create a GitHubIntegration instance from environment variables.
   * Looks for GITHUB_TOKEN environment variable.
   */
  static fromEnvironment(): GitHubIntegration {
    const token = process.env.GITHUB_TOKEN;
    const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';

    if (!token) {
      throw new Error(
        'GitHub token not found. Set GITHUB_TOKEN environment variable.',
      );
    }

    return new GitHubIntegration({ token, apiUrl });
  }

  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /**
   * Post a comment to a pull request using the specified strategy.
   */
  async postPRComment(
    owner: string,
    repo: string,
    prNumber: number,
    comment: string,
    strategy: CommentStrategy = 'update',
  ): Promise<void> {
    const commentWithMarker = `${COMMENT_MARKER}\n${comment}`;

    switch (strategy) {
      case 'new':
        await this.createComment(owner, repo, prNumber, commentWithMarker);
        break;

      case 'update': {
        const existing = await this.findExistingComment(owner, repo, prNumber);
        if (existing) {
          await this.updateComment(owner, repo, existing.id, commentWithMarker);
        } else {
          await this.createComment(owner, repo, prNumber, commentWithMarker);
        }
        break;
      }

      case 'delete-and-new': {
        const existingComment = await this.findExistingComment(owner, repo, prNumber);
        if (existingComment) {
          await this.deleteComment(owner, repo, existingComment.id);
        }
        await this.createComment(owner, repo, prNumber, commentWithMarker);
        break;
      }

      default:
        throw new Error(`Unknown comment strategy: ${strategy}`);
    }
  }

  /**
   * Find an existing cost analyzer comment on a PR.
   */
  async findExistingComment(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<GitHubComment | null> {
    const url = `${this.config.apiUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitHubAPIError(
          `Failed to list comments: ${response.statusText} - ${errorText}`,
          response.status,
        );
      }

      const comments = await response.json() as GitHubComment[];

      // Find comment with our marker
      for (const comment of comments) {
        if (comment.body && comment.body.includes(COMMENT_MARKER)) {
          return comment;
        }
      }

      return null;
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        `Failed to connect to GitHub API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update an existing comment.
   */
  async updateComment(
    owner: string,
    repo: string,
    commentId: number,
    comment: string,
  ): Promise<void> {
    const url = `${this.config.apiUrl}/repos/${owner}/${repo}/issues/comments/${commentId}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ body: comment }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitHubAPIError(
          `Failed to update comment: ${response.statusText} - ${errorText}`,
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        `Failed to connect to GitHub API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a comment.
   */
  async deleteComment(
    owner: string,
    repo: string,
    commentId: number,
  ): Promise<void> {
    const url = `${this.config.apiUrl}/repos/${owner}/${repo}/issues/comments/${commentId}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitHubAPIError(
          `Failed to delete comment: ${response.statusText} - ${errorText}`,
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        `Failed to connect to GitHub API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a new comment on a PR.
   */
  private async createComment(
    owner: string,
    repo: string,
    prNumber: number,
    comment: string,
  ): Promise<void> {
    const url = `${this.config.apiUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ body: comment }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitHubAPIError(
          `Failed to post comment: ${response.statusText} - ${errorText}`,
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        `Failed to connect to GitHub API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get headers for GitHub API requests.
   */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
}
