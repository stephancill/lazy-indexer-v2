import { db, schema, batchInsert } from "@farcaster-indexer/shared";
import { eq } from "drizzle-orm";
import type { ProcessEventJob } from "../queue.js";
import type {
  FarcasterHttpEvent,
  FarcasterHttpMessage,
} from "@farcaster-indexer/shared";
import {
  Message,
  MessageType,
  ReactionType,
  UserDataType,
  fromFarcasterTime,
} from "@farcaster/core";
import { bytesToHex } from "viem";

// Helper function to convert UserDataType enum to human-readable string
function userDataTypeToString(type: UserDataType): string {
  switch (type) {
    case UserDataType.PFP:
      return "pfp";
    case UserDataType.DISPLAY:
      return "display";
    case UserDataType.BIO:
      return "bio";
    case UserDataType.USERNAME:
      return "username";
    case UserDataType.URL:
      return "url";
    case UserDataType.LOCATION:
      return "location";
    case UserDataType.TWITTER:
      return "twitter";
    case UserDataType.GITHUB:
      return "github";
    case UserDataType.BANNER:
      return "banner";
    case UserDataType.USER_DATA_PRIMARY_ADDRESS_ETHEREUM:
      return "ethereum_address";
    case UserDataType.USER_DATA_PRIMARY_ADDRESS_SOLANA:
      return "solana_address";
    default:
      return "unknown";
  }
}

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

  private async addToBatch(event: FarcasterHttpEvent): Promise<void> {
    switch (event.type) {
      case "HUB_EVENT_TYPE_MERGE_MESSAGE":
        await this.addMessageToBatch(event);
        break;
      case "HUB_EVENT_TYPE_MERGE_ON_CHAIN_EVENT":
        await this.addOnChainEventToBatch(event);
        break;
      case "HUB_EVENT_TYPE_PRUNE_MESSAGE":
        await this.processPruneMessage(event);
        break;
      case "HUB_EVENT_TYPE_REVOKE_MESSAGE":
        await this.processRevokeMessage(event);
        break;
      default:
        console.log(`Unknown event type: ${event.type}`);
    }

    // Check if we should flush batches
    await this.checkAndFlushBatches();
  }

  private async addMessageToBatch(event: FarcasterHttpEvent): Promise<void> {
    const httpMessage = event.mergeMessageBody?.message;
    if (!httpMessage) return;
    const parsedMessage = Message.fromJSON(httpMessage);

    switch (parsedMessage.data?.type) {
      case MessageType.CAST_ADD:
        this.addCastToBatch(parsedMessage);
        break;
      case MessageType.CAST_REMOVE:
        await this.processCastRemove(parsedMessage); // Handle immediately
        break;
      case MessageType.REACTION_ADD:
        this.addReactionToBatch(parsedMessage);
        break;
      case MessageType.REACTION_REMOVE:
        await this.processReactionRemove(parsedMessage); // Handle immediately
        break;
      case MessageType.LINK_ADD:
        this.addLinkToBatch(parsedMessage);
        break;
      case MessageType.LINK_REMOVE:
        await this.processLinkRemove(parsedMessage); // Handle immediately
        break;
      case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
        this.addVerificationToBatch(parsedMessage);
        break;
      case MessageType.VERIFICATION_REMOVE:
        await this.processVerificationRemove(parsedMessage); // Handle immediately
        break;
      case MessageType.USER_DATA_ADD:
        this.addUserDataToBatch(parsedMessage);
        break;
      default:
        console.log(`Unknown message type: ${parsedMessage.data?.type}`);
    }
  }

  private addCastToBatch(message: Message): void {
    if (!message.data) return;

    const castData = message.data.castAddBody;
    if (!castData) return;

    const timestamp = fromFarcasterTime(message.data.timestamp)._unsafeUnwrap();

    this.pendingCasts.push({
      hash: bytesToHex(message.hash),
      fid: message.data.fid,
      text: castData.text,
      parentHash: castData.parentCastId?.hash
        ? bytesToHex(castData.parentCastId.hash)
        : null,
      parentFid: castData.parentCastId?.fid || null,
      parentUrl: castData.parentUrl || null,
      timestamp: new Date(timestamp),
      embeds: castData.embeds ? JSON.stringify(castData.embeds) : null,
    });
  }

  private addReactionToBatch(message: Message): void {
    if (!message.data) return;

    const reactionData = message.data.reactionBody;
    if (!reactionData || !reactionData.targetCastId) return;

    const timestamp = fromFarcasterTime(message.data.timestamp)._unsafeUnwrap();

    this.pendingReactions.push({
      hash: bytesToHex(message.hash),
      fid: message.data.fid,
      type:
        reactionData.type === ReactionType.LIKE
          ? ("like" as const)
          : ("recast" as const),
      targetHash: bytesToHex(reactionData.targetCastId.hash),
      timestamp: new Date(timestamp),
    });
  }

  private addLinkToBatch(message: Message): void {
    if (!message.data) return;

    const linkData = message.data.linkBody;
    if (!linkData) return;

    const timestamp = fromFarcasterTime(message.data.timestamp)._unsafeUnwrap();

    this.pendingLinks.push({
      hash: bytesToHex(message.hash),
      fid: message.data.fid,
      targetFid: linkData.targetFid,
      type: "follow" as const,
      timestamp: new Date(timestamp),
    });
  }

  private addVerificationToBatch(message: Message): void {
    if (!message.data) return;

    const verificationData = message.data.verificationAddAddressBody;
    if (!verificationData) return;

    const timestamp = fromFarcasterTime(message.data.timestamp)._unsafeUnwrap();

    this.pendingVerifications.push({
      hash: bytesToHex(message.hash),
      fid: message.data.fid,
      address: verificationData.address,
      protocol: "ethereum" as const,
      timestamp: new Date(timestamp),
    });
  }

  private addUserDataToBatch(message: Message): void {
    if (!message.data) return;

    const userDataBody = message.data.userDataBody;
    if (!userDataBody) return;

    const timestamp = fromFarcasterTime(message.data.timestamp)._unsafeUnwrap();

    this.pendingUserData.push({
      message,
      userDataRecord: {
        hash: bytesToHex(message.hash),
        fid: message.data.fid,
        type: userDataTypeToString(userDataBody.type),
        value: userDataBody.value,
        timestamp: new Date(timestamp),
      },
    });
  }

  private async addOnChainEventToBatch(
    event: FarcasterHttpEvent
  ): Promise<void> {
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
      signerEventBody: onChainEvent.signerEventBody
        ? JSON.stringify(onChainEvent.signerEventBody)
        : null,
      idRegistryEventBody: onChainEvent.idRegisterEventBody
        ? JSON.stringify(onChainEvent.idRegisterEventBody)
        : null,
    });
  }

  private async checkAndFlushBatches(): Promise<void> {
    const totalPending =
      this.pendingCasts.length +
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
      { name: "casts", data: this.pendingCasts, table: schema.casts },
      {
        name: "reactions",
        data: this.pendingReactions,
        table: schema.reactions,
      },
      { name: "links", data: this.pendingLinks, table: schema.links },
      {
        name: "verifications",
        data: this.pendingVerifications,
        table: schema.verifications,
      },
      {
        name: "onChainEvents",
        data: this.pendingOnChainEvents,
        table: schema.onChainEvents,
      },
    ];

    // Process regular batches
    for (const batch of batches) {
      if (batch.data.length > 0) {
        try {
          await batchInsert(batch.table, batch.data, {
            batchSize: 100,
            onConflictDoNothing: true,
          });
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
        const userDataRecords = this.pendingUserData.map(
          (item) => item.userDataRecord
        );
        await batchInsert(schema.userData, userDataRecords, {
          batchSize: 100,
          onConflictDoNothing: true,
        });

        // Update user profiles
        await this.batchUpdateUserProfiles(this.pendingUserData);

        console.log(
          `Batch processed ${this.pendingUserData.length} user data records`
        );
        this.pendingUserData.length = 0;
      } catch (error) {
        console.error("Failed to batch process user data:", error);
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

      const updateData = userUpdates.get(fid);
      if (!updateData) {
        console.warn(`No update data found for fid: ${fid}`);
        continue;
      }

      const userDataTypeString = userDataTypeToString(userDataBody.type);

      switch (userDataTypeString) {
        case "pfp":
          updateData.pfpUrl = userDataBody.value;
          break;
        case "display":
          updateData.displayName = userDataBody.value;
          break;
        case "bio":
          updateData.bio = userDataBody.value;
          break;
        case "username":
          updateData.username = userDataBody.value;
          break;
      }
    }

    // Batch update user profiles
    for (const updateData of userUpdates.values()) {
      try {
        await db.insert(schema.users).values(updateData).onConflictDoUpdate({
          target: schema.users.fid,
          set: updateData,
        });
      } catch (error) {
        console.error(
          `Failed to update user profile for FID ${updateData.fid}:`,
          error
        );
      }
    }
  }

  // Ensure batches are flushed on shutdown
  async shutdown(): Promise<void> {
    await this.flushAllBatches();
  }

  private async processPruneMessage(event: FarcasterHttpEvent): Promise<void> {
    const httpMessage = event.pruneMessageBody?.message;
    if (!httpMessage) return;

    const parsedMessage = Message.fromJSON(httpMessage);

    // Remove the message from the appropriate table
    await this.removeMessage(parsedMessage);
  }

  private async processRevokeMessage(event: FarcasterHttpEvent): Promise<void> {
    const httpMessage = event.revokeMessageBody?.message;
    if (!httpMessage) return;

    const parsedMessage = Message.fromJSON(httpMessage);

    // Remove the message from the appropriate table
    await this.removeMessage(parsedMessage);
  }

  private async processCastRemove(message: Message): Promise<void> {
    if (!message.data) return;

    const removeData = message.data.castRemoveBody;
    if (!removeData) return;

    await db
      .delete(schema.casts)
      .where(eq(schema.casts.hash, bytesToHex(removeData.targetHash)));
  }

  private async processReactionRemove(message: Message): Promise<void> {
    if (!message.data) return;

    const reactionData = message.data.reactionBody;
    if (!reactionData || !reactionData.targetCastId) return;

    await db
      .delete(schema.reactions)
      .where(eq(schema.reactions.hash, bytesToHex(message.hash)));
  }

  private async processLinkRemove(message: Message): Promise<void> {
    if (!message.data) return;

    await db
      .delete(schema.links)
      .where(eq(schema.links.hash, bytesToHex(message.hash)));
  }

  private async processVerificationRemove(message: Message): Promise<void> {
    if (!message.data) return;

    await db
      .delete(schema.verifications)
      .where(eq(schema.verifications.hash, bytesToHex(message.hash)));
  }

  private async removeMessage(message: Message): Promise<void> {
    if (!message.data) return;

    switch (message.data.type) {
      case MessageType.CAST_ADD:
        await db
          .delete(schema.casts)
          .where(eq(schema.casts.hash, bytesToHex(message.hash)));
        break;
      case MessageType.REACTION_ADD:
        await db
          .delete(schema.reactions)
          .where(eq(schema.reactions.hash, bytesToHex(message.hash)));
        break;
      case MessageType.LINK_ADD:
        await db
          .delete(schema.links)
          .where(eq(schema.links.hash, bytesToHex(message.hash)));
        break;
      case MessageType.VERIFICATION_ADD_ETH_ADDRESS:
        await db
          .delete(schema.verifications)
          .where(eq(schema.verifications.hash, bytesToHex(message.hash)));
        break;
      case MessageType.USER_DATA_ADD:
        await db
          .delete(schema.userData)
          .where(eq(schema.userData.hash, bytesToHex(message.hash)));
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

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return async (job: ProcessEventJob) => {
    await worker.processJob(job);
  };
}
