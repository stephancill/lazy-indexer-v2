import { db, schema } from '@farcaster-indexer/shared';
import { eq } from 'drizzle-orm';
import type { ProcessEventJob } from '../queue.js';
import type { FarcasterEvent, FarcasterMessage } from '@farcaster-indexer/shared';

export class ProcessorWorker {
  async processJob(job: ProcessEventJob): Promise<void> {
    const { event } = job.data;
    
    console.log(`Processing event ${event.id} of type ${event.type}`);
    
    try {
      switch (event.type) {
        case 'MERGE_MESSAGE':
          await this.processMergeMessage(event);
          break;
        case 'MERGE_ON_CHAIN_EVENT':
          await this.processMergeOnChainEvent(event);
          break;
        case 'PRUNE_MESSAGE':
          await this.processPruneMessage(event);
          break;
        case 'REVOKE_MESSAGE':
          await this.processRevokeMessage(event);
          break;
        default:
          console.log(`Unknown event type: ${event.type}`);
      }
      
      console.log(`Successfully processed event ${event.id}`);
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
      throw error;
    }
  }

  private async processMergeMessage(event: FarcasterEvent): Promise<void> {
    const message = event.mergeMessageBody?.message;
    if (!message) return;

    switch (message.data.type) {
      case 'MESSAGE_TYPE_CAST_ADD':
        await this.processCastAdd(message);
        break;
      case 'MESSAGE_TYPE_CAST_REMOVE':
        await this.processCastRemove(message);
        break;
      case 'MESSAGE_TYPE_REACTION_ADD':
        await this.processReactionAdd(message);
        break;
      case 'MESSAGE_TYPE_REACTION_REMOVE':
        await this.processReactionRemove(message);
        break;
      case 'MESSAGE_TYPE_LINK_ADD':
        await this.processLinkAdd(message);
        break;
      case 'MESSAGE_TYPE_LINK_REMOVE':
        await this.processLinkRemove(message);
        break;
      case 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS':
        await this.processVerificationAdd(message);
        break;
      case 'MESSAGE_TYPE_VERIFICATION_REMOVE':
        await this.processVerificationRemove(message);
        break;
      case 'MESSAGE_TYPE_USER_DATA_ADD':
        await this.processUserDataAdd(message);
        break;
      default:
        console.log(`Unknown message type: ${message.data.type}`);
    }
  }

  private async processMergeOnChainEvent(event: FarcasterEvent): Promise<void> {
    const onChainEvent = event.mergeOnChainEventBody?.onChainEvent;
    if (!onChainEvent) return;

    const eventRecord = {
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
    };

    await db.insert(schema.onChainEvents).values(eventRecord)
      .onConflictDoNothing();
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

  private async processCastAdd(message: FarcasterMessage): Promise<void> {
    const castData = message.data.castAddBody;
    if (!castData) return;

    const castRecord = {
      hash: message.hash,
      fid: message.data.fid,
      text: castData.text,
      parentHash: castData.parentCastId?.hash || null,
      parentFid: castData.parentCastId?.fid || null,
      parentUrl: castData.parentUrl || null,
      timestamp: new Date(message.data.timestamp * 1000),
      embeds: castData.embeds ? JSON.stringify(castData.embeds) : null,
    };

    await db.insert(schema.casts).values(castRecord)
      .onConflictDoNothing();
  }

  private async processCastRemove(message: FarcasterMessage): Promise<void> {
    const removeData = message.data.castRemoveBody;
    if (!removeData) return;

    await db.delete(schema.casts)
      .where(eq(schema.casts.hash, removeData.targetHash));
  }

  private async processReactionAdd(message: FarcasterMessage): Promise<void> {
    const reactionData = message.data.reactionBody;
    if (!reactionData || !reactionData.targetCastId) return;

    const reactionRecord = {
      hash: message.hash,
      fid: message.data.fid,
      type: reactionData.type === 'LIKE' ? 'like' as const : 'recast' as const,
      targetHash: reactionData.targetCastId.hash,
      timestamp: new Date(message.data.timestamp * 1000),
    };

    await db.insert(schema.reactions).values(reactionRecord)
      .onConflictDoNothing();
  }

  private async processReactionRemove(message: FarcasterMessage): Promise<void> {
    const reactionData = message.data.reactionBody;
    if (!reactionData || !reactionData.targetCastId) return;

    await db.delete(schema.reactions)
      .where(eq(schema.reactions.hash, message.hash));
  }

  private async processLinkAdd(message: FarcasterMessage): Promise<void> {
    const linkData = message.data.linkBody;
    if (!linkData) return;

    const linkRecord = {
      hash: message.hash,
      fid: message.data.fid,
      targetFid: linkData.targetFid,
      type: 'follow' as const,
      timestamp: new Date(message.data.timestamp * 1000),
    };

    await db.insert(schema.links).values(linkRecord)
      .onConflictDoNothing();
  }

  private async processLinkRemove(message: FarcasterMessage): Promise<void> {
    await db.delete(schema.links)
      .where(eq(schema.links.hash, message.hash));
  }

  private async processVerificationAdd(message: FarcasterMessage): Promise<void> {
    const verificationData = message.data.verificationAddEthAddressBody;
    if (!verificationData) return;

    const verificationRecord = {
      hash: message.hash,
      fid: message.data.fid,
      address: verificationData.address,
      protocol: 'ethereum' as const,
      timestamp: new Date(message.data.timestamp * 1000),
    };

    await db.insert(schema.verifications).values(verificationRecord)
      .onConflictDoNothing();
  }

  private async processVerificationRemove(message: FarcasterMessage): Promise<void> {
    await db.delete(schema.verifications)
      .where(eq(schema.verifications.hash, message.hash));
  }

  private async processUserDataAdd(message: FarcasterMessage): Promise<void> {
    const userDataBody = message.data.userDataBody;
    if (!userDataBody) return;

    // Store the user data message
    const userDataRecord = {
      hash: message.hash,
      fid: message.data.fid,
      type: userDataBody.type,
      value: userDataBody.value,
      timestamp: new Date(message.data.timestamp * 1000),
    };

    await db.insert(schema.userData).values(userDataRecord)
      .onConflictDoNothing();

    // Update the user profile
    await this.updateUserProfile(message.data.fid, userDataBody.type, userDataBody.value);
  }

  private async updateUserProfile(fid: number, type: string, value: string): Promise<void> {
    const updateData: any = {
      syncedAt: new Date(),
    };

    switch (type) {
      case 'PFP':
        updateData.pfpUrl = value;
        break;
      case 'DISPLAY':
        updateData.displayName = value;
        break;
      case 'BIO':
        updateData.bio = value;
        break;
      case 'USERNAME':
        updateData.username = value;
        break;
      default:
        return; // Unknown type, skip update
    }

    await db.insert(schema.users).values({
      fid,
      ...updateData,
    })
    .onConflictDoUpdate({
      target: schema.users.fid,
      set: updateData,
    });
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
  
  return async (job: ProcessEventJob) => {
    await worker.processJob(job);
  };
}