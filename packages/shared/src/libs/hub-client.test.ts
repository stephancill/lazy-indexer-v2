import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubClient } from './hub-client.js';
import type { HubConfig } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HubClient', () => {
  let hubClient: HubClient;

  const mockHubConfigs: HubConfig[] = [
    {
      url: 'https://hub1.example.com',
    },
    {
      url: 'https://hub2.example.com',
      transformRequest: (init) => ({
        ...init,
        headers: {
          ...init.headers,
          'x-api-key': 'test-api-key',
        },
      }),
    },
  ];

  beforeEach(() => {
    hubClient = new HubClient(mockHubConfigs);
    mockFetch.mockClear();
  });

  describe('Constructor', () => {
    it('should initialize with provided hub configs', () => {
      const client = new HubClient(mockHubConfigs);
      expect(client.getCurrentHub()).toEqual(mockHubConfigs[0]);
    });

    it('should throw error when no hubs provided', () => {
      expect(() => new HubClient([])).toThrow('At least one hub configuration is required');
    });
  });

  describe('Basic Request Handling', () => {
    it('should make successful requests to primary hub', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      const result = await hubClient.request('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub1.example.com/test',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should apply hub-specific transformations', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      // Force to use second hub
      hubClient = new HubClient([mockHubConfigs[1]]);

      await hubClient.request('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub2.example.com/test',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
          },
        })
      );
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: () => null,
        },
      });

      await expect(hubClient.request('/test')).rejects.toThrow('HTTP 404: Not Found');
    });
  });

  describe('Hub Fallback Logic', () => {
    it('should fallback to next hub on failure', async () => {
      const mockResponse = { data: 'test' };
      
      // First hub fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Second hub succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      const result = await hubClient.request('/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://hub1.example.com/test', expect.any(Object));
      expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://hub2.example.com/test', expect.any(Object));
      expect(result).toEqual(mockResponse);
    });

    it('should reset to primary hub after successful request', async () => {
      const mockResponse = { data: 'test' };
      
      // First hub fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Second hub succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      await hubClient.request('/test');
      
      // Should use primary hub for next request
      expect(hubClient.getCurrentHub()).toEqual(mockHubConfigs[0]);
    });
  });

  describe('API Methods', () => {
    const mockPaginatedResponse = {
      messages: [
        { hash: 'test1', data: { fid: 1, text: 'test cast' } },
        { hash: 'test2', data: { fid: 1, text: 'test cast 2' } },
      ],
      nextPageToken: 'next-page-token',
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPaginatedResponse),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });
    });

    it('should fetch casts by FID', async () => {
      const result = await hubClient.getCastsByFid(1);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub1.example.com/v1/castsByFid?fid=1',
        expect.any(Object)
      );
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should fetch casts with pagination options', async () => {
      await hubClient.getCastsByFid(1, {
        pageSize: 50,
        pageToken: 'token123',
        reverse: true,
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub1.example.com/v1/castsByFid?fid=1&pageSize=50&pageToken=token123&reverse=true',
        expect.any(Object)
      );
    });

    it('should fetch reactions by FID', async () => {
      await hubClient.getReactionsByFid(1, { reactionType: 'like' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub1.example.com/v1/reactionsByFid?fid=1&reaction_type=like',
        expect.any(Object)
      );
    });

    it('should fetch links by FID', async () => {
      await hubClient.getLinksByFid(1, { linkType: 'follow' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub1.example.com/v1/linksByFid?fid=1&link_type=follow',
        expect.any(Object)
      );
    });
  });

  describe('Hub Health and Info', () => {
    it('should get hub info', async () => {
      const mockInfo = {
        version: '1.0.0',
        nickname: 'test-hub',
        rootHash: '0x123',
        dbStats: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockInfo),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      const result = await hubClient.getHubInfo();
      expect(result).toEqual(mockInfo);
    });

    it('should check hub health', async () => {
      const mockInfo = { version: '1.0.0' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockInfo),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      const result = await hubClient.getHubHealth();
      expect(result).toEqual({ healthy: true, version: '1.0.0' });
    });

    it('should handle unhealthy hub', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await hubClient.getHubHealth();
      expect(result).toEqual({ healthy: false, version: 'unknown' });
    });
  });

  describe('Utility Methods', () => {
    it('should return current hub', () => {
      expect(hubClient.getCurrentHub()).toEqual(mockHubConfigs[0]);
    });

    it('should return stats', () => {
      const stats = hubClient.getStats();
      expect(stats).toHaveProperty('currentHubIndex');
      expect(stats).toHaveProperty('requestCount');
      expect(stats).toHaveProperty('rateLimitUntil');
      expect(stats).toHaveProperty('isRateLimited');
    });

    it('should reset client state', () => {
      hubClient.reset();
      const stats = hubClient.getStats();
      expect(stats.currentHubIndex).toBe(0);
      expect(stats.requestCount).toBe(0);
      expect(stats.rateLimitUntil).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      await expect(hubClient.request('/test')).rejects.toThrow('Invalid JSON');
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(hubClient.request('/test')).rejects.toThrow('All hubs failed after 3 retries');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single hub configuration', () => {
      const singleHubClient = new HubClient([mockHubConfigs[0]]);
      expect(singleHubClient.getCurrentHub()).toEqual(mockHubConfigs[0]);
    });

    it('should handle hub with no transformRequest', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      const result = await hubClient.request('/test');
      expect(result).toEqual(mockResponse);
    });

    it('should handle empty pagination results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ messages: [] }),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      const result = await hubClient.getAllCastsByFid(1);
      expect(result).toEqual([]);
    });
  });
});