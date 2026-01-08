// Jest imports are global
import { GitLabIntegration, GitLabAPIError } from '../../src/integrations';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('GitLabIntegration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.CI_JOB_TOKEN;
    delete process.env.GITLAB_TOKEN;
    delete process.env.CI_API_V4_URL;
  });

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      const integration = new GitLabIntegration({
        token: 'test-token',
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      expect(integration).toBeInstanceOf(GitLabIntegration);
    });
  });

  describe('postMergeRequestComment', () => {
    it('should post comment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
      });

      const integration = new GitLabIntegration({
        token: 'test-token',
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      await expect(
        integration.postMergeRequestComment('123', '456', 'Test comment'),
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes',
        {
          method: 'POST',
          headers: {
            'PRIVATE-TOKEN': 'test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'Test comment',
          }),
        },
      );
    });

    it('should handle project ID with special characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
      });

      const integration = new GitLabIntegration({
        token: 'test-token',
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      await integration.postMergeRequestComment('group/project', '456', 'Test comment');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('group%2Fproject'),
        expect.any(Object),
      );
    });

    it('should throw GitLabAPIError when API returns error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid token'),
      });

      const integration = new GitLabIntegration({
        token: 'invalid-token',
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      await expect(
        integration.postMergeRequestComment('123', '456', 'Test comment'),
      ).rejects.toThrow(GitLabAPIError);

      await expect(
        integration.postMergeRequestComment('123', '456', 'Test comment'),
      ).rejects.toThrow('Failed to post comment');
    });

    it('should throw GitLabAPIError when network fails', async () => {
      mockFetch.mockReset();
      mockFetch.mockRejectedValue(new Error('Network error'));

      const integration = new GitLabIntegration({
        token: 'test-token',
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      await expect(
        integration.postMergeRequestComment('123', '456', 'Test comment'),
      ).rejects.toThrow(GitLabAPIError);

      await expect(
        integration.postMergeRequestComment('123', '456', 'Test comment'),
      ).rejects.toThrow('Failed to connect to GitLab API');
    });

    it('should include error status code in GitLabAPIError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Merge request not found'),
      });

      const integration = new GitLabIntegration({
        token: 'test-token',
        apiUrl: 'https://gitlab.example.com/api/v4',
      });

      try {
        await integration.postMergeRequestComment('123', '999', 'Test comment');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(GitLabAPIError);
        expect((error as GitLabAPIError).statusCode).toBe(404);
      }
    });
  });

  describe('fromEnvironment', () => {
    it('should create instance from CI_JOB_TOKEN', () => {
      process.env.CI_JOB_TOKEN = 'ci-token';
      process.env.CI_API_V4_URL = 'https://gitlab.ci.example.com/api/v4';

      const integration = GitLabIntegration.fromEnvironment();

      expect(integration).toBeInstanceOf(GitLabIntegration);
    });

    it('should create instance from GITLAB_TOKEN', () => {
      process.env.GITLAB_TOKEN = 'gitlab-token';

      const integration = GitLabIntegration.fromEnvironment();

      expect(integration).toBeInstanceOf(GitLabIntegration);
    });

    it('should prefer CI_JOB_TOKEN over GITLAB_TOKEN', () => {
      process.env.CI_JOB_TOKEN = 'ci-token';
      process.env.GITLAB_TOKEN = 'gitlab-token';

      const integration = GitLabIntegration.fromEnvironment();

      expect(integration).toBeInstanceOf(GitLabIntegration);
    });

    it('should use default API URL when CI_API_V4_URL not set', () => {
      process.env.GITLAB_TOKEN = 'gitlab-token';

      const integration = GitLabIntegration.fromEnvironment();

      expect(integration).toBeInstanceOf(GitLabIntegration);
    });

    it('should throw error when no token is available', () => {
      expect(() => GitLabIntegration.fromEnvironment()).toThrow(
        'GitLab token not found',
      );
    });
  });
});
