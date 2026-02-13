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
   * Supports pagination for PRs with many comments.
   */
  async findExistingComment(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<GitHubComment | null> {
    try {
      let page = 1;
      const perPage = 100;

      while (true) {
        const url = `${this.config.apiUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments?page=${page}&per_page=${perPage}`;

        const response = await this.fetchWithRetry(url, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new GitHubAPIError(
            this.sanitizeError(`Failed to list comments: ${response.statusText} - ${errorText}`),
            response.status,
          );
        }

        const comments = await response.json() as GitHubComment[];

        if (comments.length === 0) {
          break;
        }

        // Find comment with our marker
        const found = comments.find(c => c.body?.includes(COMMENT_MARKER));
        if (found) {
          return found;
        }

        page++;
      }

      return null;
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        this.sanitizeError(`Failed to connect to GitHub API: ${error instanceof Error ? error.message : String(error)}`),
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
      const response = await this.fetchWithRetry(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ body: comment }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitHubAPIError(
          this.sanitizeError(`Failed to update comment: ${response.statusText} - ${errorText}`),
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        this.sanitizeError(`Failed to connect to GitHub API: ${error instanceof Error ? error.message : String(error)}`),
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
      const response = await this.fetchWithRetry(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitHubAPIError(
          this.sanitizeError(`Failed to delete comment: ${response.statusText} - ${errorText}`),
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        this.sanitizeError(`Failed to connect to GitHub API: ${error instanceof Error ? error.message : String(error)}`),
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

    // Check comment size (GitHub limit: 65536 characters)
    const MAX_COMMENT_SIZE = 65536;
    if (comment.length > MAX_COMMENT_SIZE) {
      throw new GitHubAPIError(
        `Comment exceeds GitHub's maximum size of ${MAX_COMMENT_SIZE} characters (actual: ${comment.length})`,
      );
    }

    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ body: comment }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitHubAPIError(
          this.sanitizeError(`Failed to post comment: ${response.statusText} - ${errorText}`),
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        this.sanitizeError(`Failed to connect to GitHub API: ${error instanceof Error ? error.message : String(error)}`),
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

  /**
   * Fetch with retry logic for rate limiting.
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
  ): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const response = await fetch(url, options);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const resetTime = response.headers.get('x-ratelimit-reset');

        let delayMs = 1000 * (attempt + 1); // Exponential backoff default

        if (retryAfter) {
          delayMs = parseInt(retryAfter) * 1000;
        } else if (resetTime) {
          const resetDate = new Date(parseInt(resetTime) * 1000);
          delayMs = Math.max(0, resetDate.getTime() - Date.now());
        }

        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
      }

      // Handle other 5xx errors with retry
      if (response.status >= 500 && response.status < 600 && attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      return response;
    }

    throw new GitHubAPIError('Maximum retry attempts exceeded');
  }

  /**
   * Sanitize error messages to prevent token leakage.
   */
  private sanitizeError(error: string): string {
    return error.replace(new RegExp(this.config.token, 'g'), '***');
  }
}
