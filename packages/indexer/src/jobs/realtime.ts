import {
  db,
  type HubClient,
  schema,
  parseMessageFromJson,
} from "@farcaster-indexer/shared";
import { eq, and } from "drizzle-orm";
import type { RealtimeSyncJob } from "../queue.js";
import {
  isTargetInSet,
  isClientTargetInSet,
  addTargetToSet,
  scheduleBackfillJob,
  scheduleEventProcessing,
} from "../queue.js";
import type { FarcasterHttpEvent } from "@farcaster-indexer/shared";
import { MessageType } from "@farcaster/core";

export class RealtimeWorker {
  private hubClient: HubClient;

  constructor(hubClient: HubClient) {
    this.hubClient = hubClient;
  }

  async processJob(job: RealtimeSyncJob): Promise<void> {
    const { lastEventId } = job.data;

    console.log(
      `Starting realtime sync from event ID: ${lastEventId || "latest"}`
    );

    try {
      // Get the last processed event ID if not provided
      const startEventId =
        lastEventId || (await this.getLastProcessedEventId());

      // Fetch events from the hub
      const eventsResponse = await this.hubClient.getEvents({
        fromEventId: startEventId,
        pageSize: 100, // Process in batches
      });

      const events = eventsResponse?.events || [];
      if (events.length === 0) {
        console.log("No new events to process");
        return;
      }

      console.log(`Processing ${events.length} events`);

      // Process each event
      let processedCount = 0;
      let lastProcessedEventId = startEventId;

      for (const event of events) {
        try {
          const shouldProcess = await this.shouldProcessEvent(event);

          if (shouldProcess) {
            await this.processEvent(event);
            processedCount++;
          }

          lastProcessedEventId = event.id;
        } catch (error) {
          console.error(`Failed to process event ${event.id}:`, error);
          // Continue processing other events
        }
      }

      // Update the last processed event ID
      await this.updateLastProcessedEventId(lastProcessedEventId);

      console.log(
        `Realtime sync completed. Processed ${processedCount} relevant events out of ${events.length} total`
      );
    } catch (error) {
      console.error("Realtime sync failed:", error);
      throw error;
    }
  }

  private async shouldProcessEvent(
    event: FarcasterHttpEvent
  ): Promise<boolean> {
    try {
      // Check different event types and their relevance
      switch (event.type) {
        case "HUB_EVENT_TYPE_MERGE_MESSAGE":
          return await this.shouldProcessMergeMessage(event);
        case "HUB_EVENT_TYPE_MERGE_ON_CHAIN_EVENT":
          return await this.shouldProcessOnChainEvent(event);
        case "HUB_EVENT_TYPE_PRUNE_MESSAGE":
        case "HUB_EVENT_TYPE_REVOKE_MESSAGE":
          return await this.shouldProcessMessageRemoval(event);
        default:
          return false;
      }
    } catch (error) {
      console.error(
        `Error checking if event ${event.id} should be processed:`,
        error
      );
      return false;
    }
  }

  private async shouldProcessMergeMessage(
    event: FarcasterHttpEvent
  ): Promise<boolean> {
    const httpMessage = event.mergeMessageBody?.message;
    if (!httpMessage) return false;

    const message = parseMessageFromJson(httpMessage);
    const messageFid = message.data?.fid;
    if (!messageFid) return false;

    // Check if the message is from a target
    if (await isTargetInSet(messageFid)) {
      return true;
    }

    // Check if it's a cast reply to a target
    if (
      message.data?.type === MessageType.CAST_ADD &&
      message.data.castAddBody?.parentCastId
    ) {
      const parentFid = message.data.castAddBody.parentCastId.fid;
      if (await isTargetInSet(parentFid)) {
        return true;
      }
    }

    // Check if it's a reaction to a target's cast
    if (
      message.data?.type === MessageType.REACTION_ADD &&
      message.data.reactionBody?.targetCastId
    ) {
      const targetFid = message.data.reactionBody.targetCastId.fid;
      if (await isTargetInSet(targetFid)) {
        return true;
      }
    }

    // Check if it's a follow/unfollow of a target
    if (message.data?.type === MessageType.LINK_ADD && message.data.linkBody) {
      const targetFid = message.data.linkBody.targetFid;
      if (targetFid && (await isTargetInSet(targetFid))) {
        return true;
      }
    }

    return false;
  }

  private async shouldProcessOnChainEvent(
    event: FarcasterHttpEvent
  ): Promise<boolean> {
    const onChainEvent = event.mergeOnChainEventBody?.onChainEvent;
    if (!onChainEvent) return false;

    // Check if it's a signer event for a client we're monitoring
    if (onChainEvent.type === "EVENT_TYPE_SIGNER_ADD") {
      const signerFid = onChainEvent.fid;
      if (await isClientTargetInSet(signerFid)) {
        return true;
      }
    }

    // Check if it's related to any of our targets
    const eventFid = onChainEvent.fid;
    if (await isTargetInSet(eventFid)) {
      return true;
    }

    return false;
  }

  private async shouldProcessMessageRemoval(
    event: FarcasterHttpEvent
  ): Promise<boolean> {
    const message =
      event.pruneMessageBody?.message || event.revokeMessageBody?.message;
    if (!message) return false;

    const messageFid = message.data.fid;
    return await isTargetInSet(messageFid);
  }

  private async processEvent(event: FarcasterHttpEvent): Promise<void> {
    // Schedule the event for processing in a separate queue
    await scheduleEventProcessing(event);

    // Handle dynamic target expansion
    await this.handleDynamicTargetExpansion(event);
  }

  private async handleDynamicTargetExpansion(
    event: FarcasterHttpEvent
  ): Promise<void> {
    try {
      switch (event.type) {
        case "HUB_EVENT_TYPE_MERGE_MESSAGE":
          await this.handleMergeMessageExpansion(event);
          break;
        case "HUB_EVENT_TYPE_MERGE_ON_CHAIN_EVENT":
          await this.handleOnChainEventExpansion(event);
          break;
      }
    } catch (error) {
      console.error(
        `Failed to handle dynamic expansion for event ${event.id}:`,
        error
      );
    }
  }

  private async handleMergeMessageExpansion(
    event: FarcasterHttpEvent
  ): Promise<void> {
    const httpMessage = event.mergeMessageBody?.message;
    if (!httpMessage) return;

    const message = parseMessageFromJson(httpMessage);

    // Handle follow/unfollow events from root targets
    if (message.data?.type === MessageType.LINK_ADD && message.data.linkBody) {
      const followerFid = message.data.fid;
      const targetFid = message.data.linkBody.targetFid;
      const linkType = message.data.linkBody.type;

      if (!followerFid || !targetFid) return;

      // Check if this is a follow from a root target
      const rootTarget = await db
        .select()
        .from(schema.targets)
        .where(
          and(
            eq(schema.targets.fid, followerFid),
            eq(schema.targets.isRoot, true)
          )
        )
        .limit(1);

      if (rootTarget.length > 0) {
        if (linkType === "follow") {
          await this.addNewTarget(targetFid);
        } else if (linkType === "unfollow") {
          await this.handleUnfollow(targetFid);
        }
      }
    }
  }

  private async handleOnChainEventExpansion(
    event: FarcasterHttpEvent
  ): Promise<void> {
    const onChainEvent = event.mergeOnChainEventBody?.onChainEvent;
    if (!onChainEvent) return;

    // Handle signer events from monitored clients
    if (onChainEvent.type === "EVENT_TYPE_SIGNER_ADD") {
      const signerFid = onChainEvent.fid;

      // Check if this is a client we're monitoring
      if (await isClientTargetInSet(signerFid)) {
        // Add the user as a new root target
        await this.addNewRootTarget(onChainEvent.fid);
      }
    }
  }

  private async addNewTarget(fid: number): Promise<void> {
    try {
      // Check if target already exists
      const existingTarget = await db
        .select()
        .from(schema.targets)
        .where(eq(schema.targets.fid, fid))
        .limit(1);

      if (existingTarget.length === 0) {
        // Add new target
        await db.insert(schema.targets).values({
          fid,
          isRoot: false,
          addedAt: new Date(),
          lastSyncedAt: null,
        });

        // Add to Redis set
        await addTargetToSet(fid);

        // Schedule backfill job
        await scheduleBackfillJob(fid, false);

        console.log(`Added new target FID ${fid} via dynamic expansion`);
      }
    } catch (error) {
      console.error(`Failed to add new target FID ${fid}:`, error);
    }
  }

  private async addNewRootTarget(fid: number): Promise<void> {
    try {
      // Check if target already exists
      const existingTarget = await db
        .select()
        .from(schema.targets)
        .where(eq(schema.targets.fid, fid))
        .limit(1);

      if (existingTarget.length === 0) {
        // Add new root target
        await db.insert(schema.targets).values({
          fid,
          isRoot: true,
          addedAt: new Date(),
          lastSyncedAt: null,
        });

        // Add to Redis set
        await addTargetToSet(fid);

        // Schedule backfill job
        await scheduleBackfillJob(fid, true);

        console.log(`Added new root target FID ${fid} via client discovery`);
      } else if (!existingTarget[0].isRoot) {
        // Promote existing target to root
        await db
          .update(schema.targets)
          .set({ isRoot: true })
          .where(eq(schema.targets.fid, fid));

        console.log(`Promoted FID ${fid} to root target via client discovery`);
      }
    } catch (error) {
      console.error(`Failed to add new root target FID ${fid}:`, error);
    }
  }

  private async handleUnfollow(targetFid: number): Promise<void> {
    try {
      // Check if any other root targets are still following this user
      // This is a simplified check - in practice we'd need a proper join with links table
      const remainingFollows = await db
        .select()
        .from(schema.targets)
        .where(
          and(
            eq(schema.targets.fid, targetFid),
            eq(schema.targets.isRoot, false)
          )
        )
        .limit(1);

      if (remainingFollows.length === 0) {
        // No other root targets follow this user, remove them
        await db
          .delete(schema.targets)
          .where(eq(schema.targets.fid, targetFid));

        // Remove from Redis set
        const { removeTargetFromSet } = await import("../queue.js");
        await removeTargetFromSet(targetFid);

        console.log(
          `Removed target FID ${targetFid} - no longer followed by any root targets`
        );
      }
    } catch (error) {
      console.error(
        `Failed to handle unfollow for target FID ${targetFid}:`,
        error
      );
    }
  }

  private async getLastProcessedEventId(): Promise<number> {
    try {
      const result = await db
        .select()
        .from(schema.syncState)
        .where(eq(schema.syncState.name, "last_event_id"))
        .limit(1);

      return result.length > 0 ? result[0].lastEventId || 0 : 0;
    } catch (error) {
      console.error("Failed to get last processed event ID:", error);
      return 0;
    }
  }

  private async updateLastProcessedEventId(eventId: number): Promise<void> {
    try {
      await db
        .insert(schema.syncState)
        .values({
          name: "last_event_id",
          lastEventId: eventId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.syncState.name,
          set: {
            lastEventId: eventId,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      console.error("Failed to update last processed event ID:", error);
    }
  }
}

// Factory function to create worker processor
export function createRealtimeProcessor(hubClient: HubClient) {
  const worker = new RealtimeWorker(hubClient);

  return async (job: RealtimeSyncJob) => {
    await worker.processJob(job);
  };
}
