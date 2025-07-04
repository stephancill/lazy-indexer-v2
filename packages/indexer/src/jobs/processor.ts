import { db, schema } from '@farcaster-indexer/shared';
import { eq } from 'drizzle-orm';
import type { ProcessEventJob } from '../queue.js';
import type { FarcasterEvent, FarcasterMessage } from '@farcaster-indexer/shared';

export class ProcessorWorker {
  private pendingCasts: any[] = [];
  private pendingReactions: any[] = [];
  private pendingLinks: any[] = [];
  private pendingVerifications: any[] = [];
  private pendingUserData: any[] = [];
  private pendingOnChainEvents: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_TIMEOUT = 1000; // 1 second

  async processJob(job: ProcessEventJob): Promise<void> {
    const { event } = job.data;
    
    console.log(`Processing event ${event.id} of type ${event.type}`);
    
    try {
      await this.addToBatch(event);
      console.log(`Successfully processed event ${event.id}`);
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
      throw error;
    }
  }

  private async addToBatch(event: FarcasterEvent): Promise<void> {
    switch (event.type) {
      case 'MERGE_MESSAGE':
      case 'HUB_EVENT_TYPE_MERGE_MESSAGE':
        await this.addMessageToBatch(event);
        break;
      case 'MERGE_ON_CHAIN_EVENT':
      case 'HUB_EVENT_TYPE_MERGE_ON_CHAIN_EVENT':
        await this.addOnChainEventToBatch(event);
        break;
      case 'PRUNE_MESSAGE':
      case 'HUB_EVENT_TYPE_PRUNE_MESSAGE':
        await this.processPruneMessage(event); // Handle immediately
        break;
      case 'REVOKE_MESSAGE':
      case 'HUB_EVENT_TYPE_REVOKE_MESSAGE':
        await this.processRevokeMessage(event); // Handle immediately
        break;
      default:
        console.log(`Unknown event type: ${event.type}`);
    }

    // Check if we should flush batches
    await this.checkAndFlushBatches();
  }

  private async addMessageToBatch(event: FarcasterEvent): Promise<void> {
    const message = event.mergeMessageBody?.message;
    if (!message) return;

    switch (message.data.type) {
      case 'MESSAGE_TYPE_CAST_ADD':
        this.addCastToBatch(message);
        break;
      case 'MESSAGE_TYPE_CAST_REMOVE':
        await this.processCastRemove(message); // Handle immediately
        break;
      case 'MESSAGE_TYPE_REACTION_ADD':
        this.addReactionToBatch(message);
        break;
      case 'MESSAGE_TYPE_REACTION_REMOVE':
        await this.processReactionRemove(message); // Handle immediately
        break;
      case 'MESSAGE_TYPE_LINK_ADD':
        this.addLinkToBatch(message);
        break;
      case 'MESSAGE_TYPE_LINK_REMOVE':
        await this.processLinkRemove(message); // Handle immediately
        break;
      case 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS':
        this.addVerificationToBatch(message);
        break;
      case 'MESSAGE_TYPE_VERIFICATION_REMOVE':
        await this.processVerificationRemove(message); // Handle immediately
        break;
      case 'MESSAGE_TYPE_USER_DATA_ADD':
        this.addUserDataToBatch(message);
        break;
      default:
        console.log(`Unknown message type: ${message.data.type}`);
    }
  }

  private addCastToBatch(message: FarcasterMessage): void {
    const castData = message.data.castAddBody;
    if (!castData) return;

    this.pendingCasts.push({
      hash: message.hash,
      fid: message.data.fid,
      text: castData.text,
      parentHash: castData.parentCastId?.hash || null,
      parentFid: castData.parentCastId?.fid || null,
      parentUrl: castData.parentUrl || null,
      timestamp: new Date(message.data.timestamp * 1000),
      embeds: castData.embeds ? JSON.stringify(castData.embeds) : null,
    });
  }

  private addReactionToBatch(message: FarcasterMessage): void {
    const reactionData = message.data.reactionBody;
    if (!reactionData || !reactionData.targetCastId) return;

    this.pendingReactions.push({
      hash: message.hash,
      fid: message.data.fid,
      type: reactionData.type === 'LIKE' ? 'like' as const : 'recast' as const,
      targetHash: reactionData.targetCastId.hash,
      timestamp: new Date(message.data.timestamp * 1000),
    });
  }

  private addLinkToBatch(message: FarcasterMessage): void {
    const linkData = message.data.linkBody;
    if (!linkData) return;

    this.pendingLinks.push({
      hash: message.hash,
      fid: message.data.fid,
      targetFid: linkData.targetFid,
      type: 'follow' as const,
      timestamp: new Date(message.data.timestamp * 1000),
    });
  }

  private addVerificationToBatch(message: FarcasterMessage): void {
    const verificationData = message.data.verificationAddEthAddressBody;
    if (!verificationData) return;

    this.pendingVerifications.push({
      hash: message.hash,
      fid: message.data.fid,
      address: verificationData.address,
      protocol: 'ethereum' as const,
      timestamp: new Date(message.data.timestamp * 1000),
    });
  }

  private addUserDataToBatch(message: FarcasterMessage): void {
    const userDataBody = message.data.userDataBody;
    if (!userDataBody) return;

    this.pendingUserData.push({
      message,
      userDataRecord: {
        hash: message.hash,
        fid: message.data.fid,
        type: userDataBody.type,
        value: userDataBody.value,
        timestamp: new Date(message.data.timestamp * 1000),
      }
    });
  }

  private async addOnChainEventToBatch(event: FarcasterEvent): Promise<void> {
    const onChainEvent = event.mergeOnChainEventBody?.onChainEvent;
    if (!onChainEvent) return;

    this.pendingOnChainEvents.push({
      type: onChainEvent.type,
      chainId: onChainEvent.chainId,
      blockNumber: onChainEvent.blockNumber,
      blockHash: onChainEvent.blockHash,
      blockTimestamp: new Date(onChainEvent.blockTimestamp * 1000),
      transactionHash: onChainEvent.transactionHash,
      logIndex: onChainEvent.logIndex,
      fid: onChainEvent.fid,
      signerEventBody: onChainEvent.signerEventBody ? JSON.stringify(onChainEvent.signerEventBody) : null,
      idRegistryEventBody: onChainEvent.idRegisterEventBody ? JSON.stringify(onChainEvent.idRegisterEventBody) : null,
    });
  }

  private async checkAndFlushBatches(): Promise<void> {
    const totalPending = this.pendingCasts.length + 
                        this.pendingReactions.length + 
                        this.pendingLinks.length + 
                        this.pendingVerifications.length + 
                        this.pendingUserData.length + 
                        this.pendingOnChainEvents.length;

    if (totalPending >= this.BATCH_SIZE) {
      await this.flushAllBatches();
    } else if (totalPending > 0 && !this.batchTimer) {
      // Start timer for batch timeout
      this.batchTimer = setTimeout(() => {
        this.flushAllBatches().catch(console.error);
      }, this.BATCH_TIMEOUT);
    }
  }

  private async flushAllBatches(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batches = [
      { name: 'casts', data: this.pendingCasts, table: schema.casts },
      { name: 'reactions', data: this.pendingReactions, table: schema.reactions },
      { name: 'links', data: this.pendingLinks, table: schema.links },
      { name: 'verifications', data: this.pendingVerifications, table: schema.verifications },
      { name: 'onChainEvents', data: this.pendingOnChainEvents, table: schema.onChainEvents },
    ];

    // Process regular batches
    for (const batch of batches) {
      if (batch.data.length > 0) {
        try {
          await db.insert(batch.table).values(batch.data).onConflictDoNothing();
          console.log(`Batch inserted ${batch.data.length} ${batch.name}`);
          batch.data.length = 0; // Clear the batch
        } catch (error) {
          console.error(`Failed to batch insert ${batch.name}:`, error);
          batch.data.length = 0; // Clear even on error to prevent memory leaks
        }
      }
    }

    // Handle user data batch (requires special processing)
    if (this.pendingUserData.length > 0) {
      try {
        // Insert user data records
        const userDataRecords = this.pendingUserData.map(item => item.userDataRecord);
        await db.insert(schema.userData).values(userDataRecords).onConflictDoNothing();
        
        // Update user profiles
        await this.batchUpdateUserProfiles(this.pendingUserData);
        
        console.log(`Batch processed ${this.pendingUserData.length} user data records`);
        this.pendingUserData.length = 0;
      } catch (error) {
        console.error('Failed to batch process user data:', error);
        this.pendingUserData.length = 0;
      }
    }
  }

  private async batchUpdateUserProfiles(userData: any[]): Promise<void> {
    // Group user data by FID to aggregate updates
    const userUpdates = new Map<number, any>();

    for (const { message } of userData) {
      const fid = message.data.fid;
      const userDataBody = message.data.userDataBody;
      
      if (!userUpdates.has(fid)) {
        userUpdates.set(fid, { fid, syncedAt: new Date() });
      }

      const updateData = userUpdates.get(fid)!;
      
      switch (userDataBody.type) {
        case 'PFP':
          updateData.pfpUrl = userDataBody.value;
          break;
        case 'DISPLAY':
          updateData.displayName = userDataBody.value;
          break;
        case 'BIO':
          updateData.bio = userDataBody.value;
          break;
        case 'USERNAME':
          updateData.username = userDataBody.value;
          break;
      }
    }

    // Batch update user profiles
    for (const updateData of userUpdates.values()) {
      try {
        await db.insert(schema.users).values(updateData)
          .onConflictDoUpdate({
            target: schema.users.fid,
            set: updateData,
          });
      } catch (error) {
        console.error(`Failed to update user profile for FID ${updateData.fid}:`, error);
      }
    }
  }

  // Ensure batches are flushed on shutdown
  async shutdown(): Promise<void> {
    await this.flushAllBatches();
  }

  private async processPruneMessage(event: FarcasterEvent): Promise<void> {
    const message = event.pruneMessageBody?.message;
    if (!message) return;

    // Remove the message from the appropriate table
    await this.removeMessage(message);
  }

  private async processRevokeMessage(event: FarcasterEvent): Promise<void> {
    const message = event.revokeMessageBody?.message;
    if (!message) return;

    // Remove the message from the appropriate table
    await this.removeMessage(message);
  }


  private async processCastRemove(message: FarcasterMessage): Promise<void> {
    const removeData = message.data.castRemoveBody;
    if (!removeData) return;

    await db.delete(schema.casts)
      .where(eq(schema.casts.hash, removeData.targetHash));
  }


  private async processReactionRemove(message: FarcasterMessage): Promise<void> {
    const reactionData = message.data.reactionBody;
    if (!reactionData || !reactionData.targetCastId) return;

    await db.delete(schema.reactions)
      .where(eq(schema.reactions.hash, message.hash));
  }


  private async processLinkRemove(message: FarcasterMessage): Promise<void> {
    await db.delete(schema.links)
      .where(eq(schema.links.hash, message.hash));
  }


  private async processVerificationRemove(message: FarcasterMessage): Promise<void> {
    await db.delete(schema.verifications)
      .where(eq(schema.verifications.hash, message.hash));
  }


  private async removeMessage(message: FarcasterMessage): Promise<void> {
    switch (message.data.type) {
      case 'MESSAGE_TYPE_CAST_ADD':
        await db.delete(schema.casts).where(eq(schema.casts.hash, message.hash));
        break;
      case 'MESSAGE_TYPE_REACTION_ADD':
        await db.delete(schema.reactions).where(eq(schema.reactions.hash, message.hash));
        break;
      case 'MESSAGE_TYPE_LINK_ADD':
        await db.delete(schema.links).where(eq(schema.links.hash, message.hash));
        break;
      case 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS':
        await db.delete(schema.verifications).where(eq(schema.verifications.hash, message.hash));
        break;
      case 'MESSAGE_TYPE_USER_DATA_ADD':
        await db.delete(schema.userData).where(eq(schema.userData.hash, message.hash));
        break;
      default:
        console.log(`Cannot remove message of type: ${message.data.type}`);
    }
  }
}

// Factory function to create worker processor
export function createProcessorWorker() {
  const worker = new ProcessorWorker();
  
  // Set up graceful shutdown
  const shutdown = async () => {
    await worker.shutdown();
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  return async (job: ProcessEventJob) => {
    await worker.processJob(job);
  };
}