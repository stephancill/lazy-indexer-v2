import { describe, it, expect, beforeAll } from 'vitest';
import { config, HubClient } from '@farcaster-indexer/shared';
import { initializeTargetSets } from '../queue.js';

describe('Live Farcaster Hub Integration', () => {
  let hubClient: HubClient;

  beforeAll(async () => {
    // Initialize hub client with live configuration
    hubClient = new HubClient(config.hubs);
    
    // Initialize target sets (will connect to Redis)
    await initializeTargetSets();
  }, 30000); // 30 second timeout for setup

  describe('Hub Client Integration', () => {
    it('should connect to live Farcaster hub', async () => {
      // Test basic hub info endpoint
      const info = await hubClient.getHubInfo();
      expect(info).toBeDefined();
      expect(info.version).toBeDefined();
      console.log('Connected to hub version:', info.version);
    });

    it('should fetch recent events from hub', async () => {
      const eventsResponse = await hubClient.getEvents({ 
        pageSize: 10 
      });
      
      expect(eventsResponse).toBeDefined();
      expect(eventsResponse.events).toBeDefined();
      expect(Array.isArray(eventsResponse.events)).toBe(true);
      
      console.log(`Fetched ${eventsResponse.events.length} events from hub`);
      
      if (eventsResponse.events.length > 0) {
        const firstEvent = eventsResponse.events[0];
        expect(firstEvent.id).toBeDefined();
        expect(firstEvent.type).toBeDefined();
        console.log('First event:', { id: firstEvent.id, type: firstEvent.type });
      }
    }, 15000);

    it('should fetch user data from hub', async () => {
      // Test with FID 1 (Farcaster founder)
      const userDataResponse = await hubClient.getAllUserDataByFid(1);
      
      expect(userDataResponse).toBeDefined();
      expect(Array.isArray(userDataResponse)).toBe(true);
      
      console.log(`Fetched ${userDataResponse.length} user data records for FID 1`);
      
      if (userDataResponse.length > 0) {
        const userData = userDataResponse[0];
        expect(userData.data).toBeDefined();
        expect(userData.data.fid).toBe(1);
        console.log('User data types:', userDataResponse.map(ud => ud.data.userDataBody?.type));
      }
    });

    it('should handle hub fallback correctly', async () => {
      // This test verifies that the fallback logic works
      // by making a request that should succeed on at least one hub
      
      let success = false;
      try {
        const response = await hubClient.getHubInfo();
        if (response && response.version) {
          success = true;
        }
      } catch (error) {
        console.error('Hub fallback test failed:', error);
      }
      
      expect(success).toBe(true);
    });
  });

  describe('Event Processing Validation', () => {
    it('should validate event structure from live hub', async () => {
      const eventsResponse = await hubClient.getEvents({ 
        pageSize: 5 
      });
      
      if (eventsResponse.events.length === 0) {
        console.log('No events to validate, skipping test');
        return;
      }

      for (const event of eventsResponse.events) {
        // Validate basic event structure
        expect(event.id).toBeDefined();
        expect(typeof event.id).toBe('number');
        expect(event.type).toBeDefined();
        expect(typeof event.type).toBe('string');
        
        // Validate specific event types
        switch (event.type) {
          case 'HUB_EVENT_TYPE_MERGE_MESSAGE':
            expect(event.mergeMessageBody).toBeDefined();
            expect(event.mergeMessageBody?.message).toBeDefined();
            break;
          case 'HUB_EVENT_TYPE_MERGE_ON_CHAIN_EVENT':
            expect(event.mergeOnChainEventBody).toBeDefined();
            expect(event.mergeOnChainEventBody?.onChainEvent).toBeDefined();
            break;
          case 'HUB_EVENT_TYPE_PRUNE_MESSAGE':
            expect(event.pruneMessageBody).toBeDefined();
            break;
          case 'HUB_EVENT_TYPE_REVOKE_MESSAGE':
            expect(event.revokeMessageBody).toBeDefined();
            break;
        }
      }
      
      console.log(`Validated ${eventsResponse.events.length} events successfully`);
    }, 15000);

    it('should handle rate limiting gracefully', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        requests.push(hubClient.getHubInfo());
      }
      
      const results = await Promise.allSettled(requests);
      
      // At least some requests should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
      
      console.log(`${successful}/5 requests succeeded (rate limiting may have affected some)`);
    }, 15000);
  });

  describe('Data Quality Validation', () => {
    it('should validate message data integrity', async () => {
      // Fetch some casts to validate data structure
      const castsResponse = await hubClient.getAllCastsByFid(1);
      
      if (castsResponse.length === 0) {
        console.log('No casts to validate, skipping test');
        return;
      }

      // Just validate first 5 casts to keep test fast
      const castsToValidate = castsResponse.slice(0, 5);
      for (const cast of castsToValidate) {
        expect(cast.data).toBeDefined();
        expect(cast.data.fid).toBe(1);
        expect(cast.hash).toBeDefined();
        expect(cast.signature).toBeDefined();
        
        // Validate timestamp is reasonable (not in the future)
        const messageTime = cast.data.timestamp * 1000;
        const now = Date.now();
        expect(messageTime).toBeLessThanOrEqual(now);
        
        // Handle different message types
        if (cast.data.type === 'MESSAGE_TYPE_CAST_ADD') {
          expect(cast.data.castAddBody).toBeDefined();
          const castBody = cast.data.castAddBody!;
          expect(typeof castBody.text).toBe('string');
          expect(Array.isArray(castBody.embeds)).toBe(true);
        } else if (cast.data.type === 'MESSAGE_TYPE_CAST_REMOVE') {
          expect(cast.data.castRemoveBody).toBeDefined();
        }
      }
      
      console.log(`Validated ${castsToValidate.length} cast messages successfully`);
    }, 15000);

    it('should validate user data consistency', async () => {
      // Test with a known active user (FID 1)
      const userData = await hubClient.getAllUserDataByFid(1);
      
      if (userData.length === 0) {
        console.log('No user data to validate, skipping test');
        return;
      }

      // Group by type to check for duplicates
      const dataByType = new Map();
      
      for (const data of userData) {
        const type = data.data.userDataBody?.type;
        if (type) {
          if (dataByType.has(type)) {
            // Multiple entries of same type should have different timestamps
            // (latest one wins)
            const existing = dataByType.get(type);
            const current = data.data.timestamp;
            expect(current).not.toBe(existing.timestamp);
          }
          dataByType.set(type, { 
            value: data.data.userDataBody?.value,
            timestamp: data.data.timestamp 
          });
        }
      }
      
      console.log('User data types found:', Array.from(dataByType.keys()));
      expect(dataByType.size).toBeGreaterThan(0);
    });
  });

  describe('Performance Validation', () => {
    it('should maintain acceptable response times', async () => {
      const startTime = Date.now();
      
      // Make a lighter query for faster response
      await hubClient.getEvents({ pageSize: 10 });
      
      const responseTime = Date.now() - startTime;
      console.log(`Hub response time: ${responseTime}ms`);
      
      // Should respond within 10 seconds (more lenient for network conditions)
      expect(responseTime).toBeLessThan(10000);
    }, 15000);

    it('should handle pagination efficiently', async () => {
      const startTime = Date.now();
      
      // Fetch first page with smaller size for faster response
      const firstPage = await hubClient.getEvents({ pageSize: 10 });
      
      if (firstPage.nextPageToken) {
        // Fetch second page
        await hubClient.getEvents({ 
          pageSize: 10,
          pageToken: firstPage.nextPageToken 
        });
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`Pagination test completed in ${totalTime}ms`);
      
      // Should handle pagination within reasonable time
      expect(totalTime).toBeLessThan(15000);
    }, 20000);
  });
});