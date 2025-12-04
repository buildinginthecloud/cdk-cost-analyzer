import { GitLabIntegration as IGitLabIntegration, GitLabConfig, GitLabAPIError } from './types';

export class GitLabIntegration implements IGitLabIntegration {
  private config: GitLabConfig;

  constructor(config: GitLabConfig) {
    this.config = config;
  }

  async postMergeRequestComment(
    projectId: string,
    mergeRequestIid: string,
    comment: string
  ): Promise<void> {
    const url = `${this.config.apiUrl}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/notes`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': this.config.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: comment,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitLabAPIError(
          `Failed to post comment: ${response.statusText} - ${errorText}`,
          response.status
        );
      }
    } catch (error) {
      if (error instanceof GitLabAPIError) {
        throw error;
      }
      throw new GitLabAPIError(
        `Failed to connect to GitLab API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  static fromEnvironment(): GitLabIntegration {
    const token = process.env.CI_JOB_TOKEN || process.env.GITLAB_TOKEN;
    const apiUrl = process.env.CI_API_V4_URL || 'https://gitlab.com/api/v4';

    if (!token) {
      throw new Error(
        'GitLab token not found. Set CI_JOB_TOKEN or GITLAB_TOKEN environment variable.'
      );
    }

    return new GitLabIntegration({
      token,
      apiUrl,
    });
  }
}
