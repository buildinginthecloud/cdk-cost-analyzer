// Jest imports are global
import { GitHubIntegration, GitHubAPIError } from '../../src/integrations';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('GitHubIntegration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_API_URL;
  });

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      expect(integration).toBeInstanceOf(GitHubIntegration);
    });
  });

  describe('fromEnvironment', () => {
    it('should create instance from GITHUB_TOKEN', () => {
      process.env.GITHUB_TOKEN = 'github-token';

      const integration = GitHubIntegration.fromEnvironment();

      expect(integration).toBeInstanceOf(GitHubIntegration);
    });

    it('should use default API URL when GITHUB_API_URL not set', () => {
      process.env.GITHUB_TOKEN = 'github-token';

      const integration = GitHubIntegration.fromEnvironment();

      expect(integration).toBeInstanceOf(GitHubIntegration);
    });

    it('should use custom API URL when GITHUB_API_URL is set', () => {
      process.env.GITHUB_TOKEN = 'github-token';
      process.env.GITHUB_API_URL = 'https://github.enterprise.com/api/v3';

      const integration = GitHubIntegration.fromEnvironment();

      expect(integration).toBeInstanceOf(GitHubIntegration);
    });

    it('should throw error when no token is available', () => {
      expect(() => GitHubIntegration.fromEnvironment()).toThrow(
        'GitHub token not found',
      );
    });
  });

  describe('postPRComment', () => {
    describe('with strategy "new"', () => {
      it('should create a new comment', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
        });

        const integration = new GitHubIntegration({
          token: 'test-token',
          apiUrl: 'https://api.github.com',
        });

        await expect(
          integration.postPRComment('owner', 'repo', 123, 'Test comment', 'new'),
        ).resolves.not.toThrow();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/owner/repo/issues/123/comments',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
              Accept: 'application/vnd.github+json',
            }),
            body: expect.stringContaining('Test comment'),
          }),
        );
      });
    });

    describe('with strategy "update"', () => {
      it('should create comment when no existing comment found', async () => {
        // Mock listComments - no existing comment
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        // Mock createComment
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
        });

        const integration = new GitHubIntegration({
          token: 'test-token',
          apiUrl: 'https://api.github.com',
        });

        await integration.postPRComment('owner', 'repo', 123, 'Test comment', 'update');

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          'https://api.github.com/repos/owner/repo/issues/123/comments',
          expect.objectContaining({ method: 'GET' }),
        );
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          'https://api.github.com/repos/owner/repo/issues/123/comments',
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('should update existing comment when found', async () => {
        // Mock listComments - existing comment found
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 456,
              body: '<!-- cdk-cost-analyzer -->\nOld comment',
              user: { login: 'github-actions[bot]', type: 'Bot' },
            },
          ]),
        });

        // Mock updateComment
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const integration = new GitHubIntegration({
          token: 'test-token',
          apiUrl: 'https://api.github.com',
        });

        await integration.postPRComment('owner', 'repo', 123, 'New comment', 'update');

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          'https://api.github.com/repos/owner/repo/issues/comments/456',
          expect.objectContaining({ method: 'PATCH' }),
        );
      });
    });

    describe('with strategy "delete-and-new"', () => {
      it('should delete existing comment and create new one', async () => {
        // Mock listComments - existing comment found
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 456,
              body: '<!-- cdk-cost-analyzer -->\nOld comment',
              user: { login: 'github-actions[bot]', type: 'Bot' },
            },
          ]),
        });

        // Mock deleteComment
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

        // Mock createComment
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
        });

        const integration = new GitHubIntegration({
          token: 'test-token',
          apiUrl: 'https://api.github.com',
        });

        await integration.postPRComment('owner', 'repo', 123, 'New comment', 'delete-and-new');

        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          'https://api.github.com/repos/owner/repo/issues/comments/456',
          expect.objectContaining({ method: 'DELETE' }),
        );
        expect(mockFetch).toHaveBeenNthCalledWith(
          3,
          'https://api.github.com/repos/owner/repo/issues/123/comments',
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('should create new comment when no existing comment to delete', async () => {
        // Mock listComments - no existing comment
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        // Mock createComment
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
        });

        const integration = new GitHubIntegration({
          token: 'test-token',
          apiUrl: 'https://api.github.com',
        });

        await integration.postPRComment('owner', 'repo', 123, 'New comment', 'delete-and-new');

        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('findExistingComment', () => {
    it('should find comment with marker', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 123,
            body: 'Some other comment',
            user: { login: 'user1', type: 'User' },
          },
          {
            id: 456,
            body: '<!-- cdk-cost-analyzer -->\nCost analysis report',
            user: { login: 'github-actions[bot]', type: 'Bot' },
          },
        ]),
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      const comment = await integration.findExistingComment('owner', 'repo', 123);

      expect(comment).not.toBeNull();
      expect(comment?.id).toBe(456);
    });

    it('should return null when no comment with marker found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 123,
            body: 'Some other comment',
            user: { login: 'user1', type: 'User' },
          },
        ]),
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      const comment = await integration.findExistingComment('owner', 'repo', 123);

      expect(comment).toBeNull();
    });

    it('should throw GitHubAPIError when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Bad credentials'),
      });

      const integration = new GitHubIntegration({
        token: 'invalid-token',
        apiUrl: 'https://api.github.com',
      });

      await expect(
        integration.findExistingComment('owner', 'repo', 123),
      ).rejects.toThrow(GitHubAPIError);
    });
  });

  describe('updateComment', () => {
    it('should update comment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      await expect(
        integration.updateComment('owner', 'repo', 456, 'Updated comment'),
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues/comments/456',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ body: 'Updated comment' }),
        }),
      );
    });

    it('should throw GitHubAPIError when update fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Comment not found'),
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      await expect(
        integration.updateComment('owner', 'repo', 999, 'Updated comment'),
      ).rejects.toThrow(GitHubAPIError);
    });
  });

  describe('deleteComment', () => {
    it('should delete comment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      await expect(
        integration.deleteComment('owner', 'repo', 456),
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues/comments/456',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('should throw GitHubAPIError when delete fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Comment not found'),
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      await expect(
        integration.deleteComment('owner', 'repo', 999),
      ).rejects.toThrow(GitHubAPIError);
    });
  });

  describe('error handling', () => {
    it('should wrap network errors in GitHubAPIError', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      await expect(
        integration.findExistingComment('owner', 'repo', 123),
      ).rejects.toThrow(GitHubAPIError);

      await expect(
        integration.findExistingComment('owner', 'repo', 123),
      ).rejects.toThrow('Failed to connect to GitHub API');
    });

    it('should include status code in GitHubAPIError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      try {
        await integration.findExistingComment('owner', 'repo', 123);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        expect((error as GitHubAPIError).statusCode).toBe(403);
      }
    });
  });

  describe('headers', () => {
    it('should include required GitHub API headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      await integration.findExistingComment('owner', 'repo', 123);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          }),
        }),
      );
    });
  });

  describe('comment marker', () => {
    it('should add marker to new comments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
      });

      const integration = new GitHubIntegration({
        token: 'test-token',
        apiUrl: 'https://api.github.com',
      });

      await integration.postPRComment('owner', 'repo', 123, 'Test comment', 'new');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.body).toContain('<!-- cdk-cost-analyzer -->');
      expect(callBody.body).toContain('Test comment');
    });
  });
});
