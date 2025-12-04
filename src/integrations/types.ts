export interface GitLabIntegration {
  postMergeRequestComment(
    projectId: string,
    mergeRequestIid: string,
    comment: string
  ): Promise<void>;
}

export interface GitLabConfig {
  token: string;
  apiUrl: string;
}

export class GitLabAPIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'GitLabAPIError';
  }
}
