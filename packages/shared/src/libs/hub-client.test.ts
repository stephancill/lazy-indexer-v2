import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubClient } from './hub-client.js';
import type { HubConfig } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();

// Mock samples from real hub responses
const MOCK_RESPONSES = {
  hubInfo: {
    "dbStats": {"numMessages": 692159501, "numFidRegistrations": 1114471, "approxSize": 360094955658},
    "numShards": 2,
    "version": "0.3.0",
    "peer_id": "12D3KooWPnkS8V21uozGuEFqLm5sdg1nbb28WmeSWotVsoAAhAY3"
  },
  events: {
    "events": [{
      "type": "HUB_EVENT_TYPE_MERGE_MESSAGE",
      "id": 138925965312,
      "mergeMessageBody": {
        "message": {
          "data": {
            "type": "MESSAGE_TYPE_REACTION_ADD",
            "fid": 194372,
            "timestamp": 141955200,
            "network": "FARCASTER_NETWORK_MAINNET"
          },
          "hash": "0x8fd1adc15997f6599b4330dc4784ca569ac540b8"
        }
      }
    }]
  },
  casts: {
    "messages": [{
      "data": {
        "type": "MESSAGE_TYPE_CAST_ADD",
        "fid": 1,
        "timestamp": 62108100,
        "network": "FARCASTER_NETWORK_MAINNET",
        "castAddBody": {
          "text": "testing",
          "embeds": []
        }
      },
      "hash": "0xfc10f40b0987db72b918bd39ccbe3673e145fb67"
    }],
    "nextPageToken": "AwAAAAEBA7OxxPwQ9AsJh9tyuRi9Ocy+NnPhRftn"
  }
};

// Set up global mock
globalThis.fetch = mockFetch;

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
    // Reset and configure the mock before each test
    mockFetch.mockReset();
    mockFetch.mockClear();
    
    // Set default mock implementation to avoid real network calls
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MOCK_RESPONSES.hubInfo),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      })
    );
    
    hubClient = new HubClient(mockHubConfigs, mockFetch);
  });

  describe('Constructor', () => {
    it('should initialize with provided hub configs', () => {
      const client = new HubClient(mockHubConfigs, mockFetch);
      expect(client.getCurrentHub()).toEqual(mockHubConfigs[0]);
    });

    it('should throw error when no hubs provided', () => {
      expect(() => new HubClient([], mockFetch)).toThrow('At least one hub configuration is required');
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
      hubClient = new HubClient([mockHubConfigs[1]], mockFetch);

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
      // Create a fresh mock for this test
      const errorMockFetch = vi.fn().mockImplementation(() => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: () => null,
        },
      }));

      // Create a new client instance with the error mock
      const errorTestClient = new HubClient(mockHubConfigs, errorMockFetch);
      
      await expect(errorTestClient.request('/test')).rejects.toThrow('HTTP 404: Not Found');
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
      // Mock multiple failures to ensure all hubs fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await hubClient.getHubHealth();
      expect(result).toEqual({ healthy: false, version: 'unknown' });
      
      // Reset mock for subsequent tests
      mockFetch.mockClear();
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
      // Mock all hubs to fail with JSON parsing errors
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers: {
          get: (key: string) => key === 'Content-Type' ? 'application/json' : null,
        },
      });

      await expect(hubClient.request('/test')).rejects.toThrow();
      
      // Reset mock for subsequent tests
      mockFetch.mockClear();
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(hubClient.request('/test')).rejects.toThrow('All hubs failed after 3 retries');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single hub configuration', () => {
      const singleHubClient = new HubClient([mockHubConfigs[0]], mockFetch);
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