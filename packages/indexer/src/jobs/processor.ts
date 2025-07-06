import {
  db,
  schema,
  batchInsert,
  parseMessageFromJson,
  createCastRecord,
  createReactionRecord,
  createLinkRecord,
  createVerificationRecord,
  createUserDataRecord,
  createOnChainEventRecord,
  convertMessageHash,
  type CastRecord,
  type ReactionRecord,
  type LinkRecord,
  type VerificationRecord,
  type UserDataRecord,
  type OnChainEventRecord,
} from "@farcaster-indexer/shared";
import { eq, sql } from "drizzle-orm";
import type { ProcessEventJob } from "../queue.js";
import type {
  FarcasterHttpEvent,
  FarcasterHttpMessage,
} from "@farcaster-indexer/shared";
import { Message, MessageType } from "@farcaster/core";
import { bytesToHex } from "viem";

export class ProcessorWorker {
  private pendingCasts: CastRecord[] = [];
  private pendingReactions: ReactionRecord[] = [];
  private pendingLinks: LinkRecord[] = [];
  private pendingVerifications: VerificationRecord[] = [];
  private pendingUserData: {
    message: Message;
    userDataRecord: UserDataRecord;
  }[] = [];
  private pendingOnChainEvents: OnChainEventRecord[] = [];
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
    const parsedMessage = parseMessageFromJson(httpMessage);

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
    const castRecord = createCastRecord(message);
    if (castRecord) {
      this.pendingCasts.push(castRecord);
    }
  }

  private addReactionToBatch(message: Message): void {
    const reactionRecord = createReactionRecord(message);
    if (reactionRecord) {
      this.pendingReactions.push(reactionRecord);
    }
  }

  private addLinkToBatch(message: Message): void {
    const linkRecord = createLinkRecord(message);
    if (linkRecord) {
      this.pendingLinks.push(linkRecord);
    }
  }

  private addVerificationToBatch(message: Message): void {
    const verificationRecord = createVerificationRecord(message);
    if (verificationRecord) {
      this.pendingVerifications.push(verificationRecord);
    }
  }

  private addUserDataToBatch(message: Message): void {
    const userDataRecord = createUserDataRecord(message);
    if (userDataRecord) {
      this.pendingUserData.push({
        message,
        userDataRecord,
      });
    }
  }

  private async addOnChainEventToBatch(
    event: FarcasterHttpEvent
  ): Promise<void> {
    const onChainEvent = event.mergeOnChainEventBody?.onChainEvent;
    if (!onChainEvent) return;

    const eventRecord = createOnChainEventRecord(onChainEvent);
    this.pendingOnChainEvents.push(eventRecord);
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

    // Process regular batches
    if (this.pendingCasts.length > 0) {
      try {
        await batchInsert(schema.casts, this.pendingCasts, {
          batchSize: 100,
          onConflictDoNothing: true,
        });
        console.log(`Batch inserted ${this.pendingCasts.length} casts`);
        this.pendingCasts.length = 0;
      } catch (error) {
        console.error("Failed to batch insert casts:", error);
        this.pendingCasts.length = 0;
      }
    }

    if (this.pendingReactions.length > 0) {
      try {
        await batchInsert(schema.reactions, this.pendingReactions, {
          batchSize: 100,
          onConflictDoNothing: true,
        });
        console.log(`Batch inserted ${this.pendingReactions.length} reactions`);
        this.pendingReactions.length = 0;
      } catch (error) {
        console.error("Failed to batch insert reactions:", error);
        this.pendingReactions.length = 0;
      }
    }

    if (this.pendingLinks.length > 0) {
      try {
        await batchInsert(schema.links, this.pendingLinks, {
          batchSize: 100,
          onConflictDoNothing: true,
        });
        console.log(`Batch inserted ${this.pendingLinks.length} links`);
        this.pendingLinks.length = 0;
      } catch (error) {
        console.error("Failed to batch insert links:", error);
        this.pendingLinks.length = 0;
      }
    }

    if (this.pendingVerifications.length > 0) {
      try {
        await batchInsert(schema.verifications, this.pendingVerifications, {
          batchSize: 100,
          onConflictDoNothing: true,
        });
        console.log(
          `Batch inserted ${this.pendingVerifications.length} verifications`
        );
        this.pendingVerifications.length = 0;
      } catch (error) {
        console.error("Failed to batch insert verifications:", error);
        this.pendingVerifications.length = 0;
      }
    }

    if (this.pendingOnChainEvents.length > 0) {
      try {
        await batchInsert(schema.onChainEvents, this.pendingOnChainEvents, {
          batchSize: 100,
          onConflictDoNothing: true,
        });
        console.log(
          `Batch inserted ${this.pendingOnChainEvents.length} onChainEvents`
        );
        this.pendingOnChainEvents.length = 0;
      } catch (error) {
        console.error("Failed to batch insert onChainEvents:", error);
        this.pendingOnChainEvents.length = 0;
      }
    }

    // Handle user data batch (materialized view will aggregate automatically)
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

        // Refresh users materialized view to reflect new data
        await this.refreshUsersView();

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

  private async refreshUsersView(): Promise<void> {
    try {
      // Use raw SQL to refresh the materialized view
      await db.execute(sql`REFRESH MATERIALIZED VIEW users`);
      console.log("Successfully refreshed users materialized view");
    } catch (error) {
      console.error("Failed to refresh users materialized view:", error);
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
