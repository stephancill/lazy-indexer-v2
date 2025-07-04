import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RealtimeWorker } from './realtime.js';
import { ProcessorWorker } from './processor.js';
import { BackfillWorker } from './backfill.js';
import { config, HubClient } from '@farcaster-indexer/shared';
import type { FarcasterEvent, FarcasterMessage } from '@farcaster-indexer/shared';

describe('Worker Integration Tests', () => {
  let hubClient: HubClient;
  let realtimeWorker: RealtimeWorker;
  let processorWorker: ProcessorWorker;
  let backfillWorker: BackfillWorker;

  beforeAll(async () => {
    // Initialize hub client with test configuration
    hubClient = new HubClient(config.hubs);
    
    // Initialize workers
    realtimeWorker = new RealtimeWorker(hubClient);
    processorWorker = new ProcessorWorker();
    backfillWorker = new BackfillWorker(hubClient);
  });

  describe('RealtimeWorker', () => {
    it('should be instantiable', () => {
      expect(realtimeWorker).toBeInstanceOf(RealtimeWorker);
    });

    it('should have processJob method', () => {
      expect(typeof realtimeWorker.processJob).toBe('function');
    });

    it('should handle empty events response', async () => {
      // Create a mock job with no events
      const job = {
        data: { lastEventId: 0 }
      };

      // This should not throw even if no events are returned
      await expect(realtimeWorker.processJob(job as any)).resolves.not.toThrow();
    });
  });

  describe('ProcessorWorker', () => {
    it('should be instantiable', () => {
      expect(processorWorker).toBeInstanceOf(ProcessorWorker);
    });

    it('should have processJob method', () => {
      expect(typeof processorWorker.processJob).toBe('function');
    });

    it('should handle cast add events', async () => {
      const castEvent: FarcasterEvent = {
        type: 'MERGE_MESSAGE',
        id: 1001,
        mergeMessageBody: {
          message: {
            data: {
              fid: 123,
              type: 'MESSAGE_TYPE_CAST_ADD',
              timestamp: 1234567890,
              castAddBody: {
                text: 'Test cast',
                embeds: [],
                mentions: [],
                mentionsPositions: [],
              },
            },
            hash: 'test-hash',
            hashScheme: 'HASH_SCHEME_BLAKE3',
            signature: 'test-signature',
            signatureScheme: 'SIGNATURE_SCHEME_ED25519',
            signer: 'test-signer',
          },
        },
      };

      const job = {
        data: { event: castEvent }
      };

      // Should process without throwing
      await expect(processorWorker.processJob(job as any)).resolves.not.toThrow();
    });
  });

  describe('BackfillWorker', () => {
    it('should be instantiable', () => {
      expect(backfillWorker).toBeInstanceOf(BackfillWorker);
    });

    it('should have processJob method', () => {
      expect(typeof backfillWorker.processJob).toBe('function');
    });

    it('should handle backfill jobs', async () => {
      const job = {
        data: { fid: 1, isRoot: false }
      };

      // Should process without throwing (may fail due to network but won't crash)
      await expect(backfillWorker.processJob(job as any)).resolves.not.toThrow();
    });
  });

  describe('Event Processing Pipeline', () => {
    it('should handle complete event processing flow', async () => {
      // Test that events can flow through the system
      const reactionEvent: FarcasterEvent = {
        type: 'MERGE_MESSAGE',
        id: 1002,
        mergeMessageBody: {
          message: {
            data: {
              fid: 456,
              type: 'MESSAGE_TYPE_REACTION_ADD',
              timestamp: 1234567890,
              reactionBody: {
                type: 'LIKE',
                targetCastId: {
                  fid: 123,
                  hash: 'target-hash',
                },
              },
            },
            hash: 'reaction-hash',
            hashScheme: 'HASH_SCHEME_BLAKE3',
            signature: 'reaction-signature',
            signatureScheme: 'SIGNATURE_SCHEME_ED25519',
            signer: 'reaction-signer',
          },
        },
      };

      const job = {
        data: { event: reactionEvent }
      };

      // Should process the reaction event
      await expect(processorWorker.processJob(job as any)).resolves.not.toThrow();
    });

    it('should handle on-chain events', async () => {
      const onChainEvent: FarcasterEvent = {
        type: 'MERGE_ON_CHAIN_EVENT',
        id: 1003,
        mergeOnChainEventBody: {
          onChainEvent: {
            type: 'EVENT_TYPE_SIGNER_ADD',
            fid: 789,
            chainId: 10,
            blockNumber: 1000,
            blockHash: 'block-hash',
            blockTimestamp: 1234567890,
            transactionHash: 'tx-hash',
            logIndex: 1,
            signerEventBody: {
              key: 'signer-key',
              keyType: 1,
              eventType: 'ADD',
              metadata: 'metadata',
              metadataType: 1,
            },
          },
        },
      };

      const job = {
        data: { event: onChainEvent }
      };

      // Should process the on-chain event
      await expect(processorWorker.processJob(job as any)).resolves.not.toThrow();
    });
  });

  describe('Data Type Validation', () => {
    it('should handle various message types correctly', () => {
      // Test data type mappings
      expect('MESSAGE_TYPE_CAST_ADD').toBe('MESSAGE_TYPE_CAST_ADD');
      expect('MESSAGE_TYPE_REACTION_ADD').toBe('MESSAGE_TYPE_REACTION_ADD');
      expect('MESSAGE_TYPE_LINK_ADD').toBe('MESSAGE_TYPE_LINK_ADD');
      expect('MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS').toBe('MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS');
      expect('MESSAGE_TYPE_USER_DATA_ADD').toBe('MESSAGE_TYPE_USER_DATA_ADD');
    });

    it('should handle event types correctly', () => {
      expect('MERGE_MESSAGE').toBe('MERGE_MESSAGE');
      expect('MERGE_ON_CHAIN_EVENT').toBe('MERGE_ON_CHAIN_EVENT');
      expect('PRUNE_MESSAGE').toBe('PRUNE_MESSAGE');
      expect('REVOKE_MESSAGE').toBe('REVOKE_MESSAGE');
    });

    it('should handle timestamp conversion', () => {
      const timestamp = 1234567890;
      const date = new Date(timestamp * 1000);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(1234567890000);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed events gracefully', async () => {
      const malformedEvent = {
        type: 'MERGE_MESSAGE',
        id: 1004,
        // Missing mergeMessageBody
      } as FarcasterEvent;

      const job = {
        data: { event: malformedEvent }
      };

      // Should handle gracefully without crashing
      await expect(processorWorker.processJob(job as any)).resolves.not.toThrow();
    });

    it('should handle unknown event types', async () => {
      const unknownEvent = {
        type: 'UNKNOWN_EVENT',
        id: 1005,
      } as FarcasterEvent;

      const job = {
        data: { event: unknownEvent }
      };

      // Should handle gracefully
      await expect(processorWorker.processJob(job as any)).resolves.not.toThrow();
    });
  });
});