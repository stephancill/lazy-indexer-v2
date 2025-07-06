import {
  type HubClient,
  db,
  schema,
  batchInsert,
  createCastRecordFromApiMessage,
  createReactionRecordFromApiMessage,
  createLinkRecordFromApiMessage,
  createVerificationRecordFromApiMessage,
  createUserDataRecordFromApiMessage,
  createOnChainEventRecord,
} from "@farcaster-indexer/shared";
import type {
  CastMessage,
  LinkMessage,
  OnChainEvent,
  ReactionMessage,
  UserDataMessage,
  VerificationMessage,
} from "@farcaster-indexer/shared";
import { and, eq, sql } from "drizzle-orm";
import type { BackfillJob } from "../queue.js";
import { addTargetToSet, scheduleBackfillJob } from "../queue.js";

export class BackfillWorker {
  private hubClient: HubClient;

  constructor(hubClient: HubClient) {
    this.hubClient = hubClient;
  }

  async processJob(job: BackfillJob): Promise<void> {
    const { fid, isRoot } = job.data;

    console.log(`Starting backfill for FID ${fid} (isRoot: ${isRoot})`);

    try {
      // Fetch all message types for this FID
      await Promise.all([
        this.backfillUserData(fid),
        this.backfillCasts(fid),
        this.backfillReactions(fid),
        this.backfillLinks(fid),
        this.backfillVerifications(fid),
        this.backfillOnChainEvents(fid),
      ]);

      // If this is a root target, expand the graph by processing their follows
      if (isRoot) {
        await this.expandGraphFromRootTarget(fid);
      }

      // Mark target as synced
      await this.markTargetAsSynced(fid);

      console.log(`Completed backfill for FID ${fid}`);
    } catch (error) {
      console.error(`Backfill failed for FID ${fid}:`, error);
      throw error;
    }
  }

  private async backfillUserData(fid: number): Promise<void> {
    try {
      const userDataMessages = await this.hubClient.getAllUserDataByFid(fid);

      if (userDataMessages.length === 0) {
        console.log(`No user data found for FID ${fid}`);
        return;
      }

      // Store individual user data messages (users table is now a materialized view)
      const userDataRecords = userDataMessages.map((message) =>
        createUserDataRecordFromApiMessage(message)
      );

      if (userDataRecords.length > 0) {
        await batchInsert(schema.userData, userDataRecords, {
          batchSize: 500,
          onConflictDoNothing: true,
        });

        // Refresh users materialized view to reflect new data
        await db.execute(sql`REFRESH MATERIALIZED VIEW users`);
      }

      console.log(
        `Stored ${userDataMessages.length} user data messages for FID ${fid}`
      );
    } catch (error) {
      console.error(`Failed to backfill user data for FID ${fid}:`, error);
      throw error;
    }
  }

  private async backfillCasts(fid: number): Promise<void> {
    try {
      const castMessages = await this.hubClient.getAllCastsByFid(fid);

      if (castMessages.length === 0) {
        console.log(`No casts found for FID ${fid}`);
        return;
      }

      const castRecords = castMessages.map((message) =>
        createCastRecordFromApiMessage(message)
      );

      if (castRecords.length > 0) {
        await batchInsert(schema.casts, castRecords, {
          batchSize: 500,
          onConflictDoNothing: true,
        });
      }

      console.log(`Stored ${castMessages.length} casts for FID ${fid}`);
    } catch (error) {
      console.error(`Failed to backfill casts for FID ${fid}:`, error);
      throw error;
    }
  }

  private async backfillReactions(fid: number): Promise<void> {
    try {
      const reactionMessages = await this.hubClient.getAllReactionsByFid(fid);

      if (reactionMessages.length === 0) {
        console.log(`No reactions found for FID ${fid}`);
        return;
      }

      const reactionRecords = reactionMessages.map((message) =>
        createReactionRecordFromApiMessage(message)
      );

      if (reactionRecords.length > 0) {
        await batchInsert(schema.reactions, reactionRecords, {
          batchSize: 500,
          onConflictDoNothing: true,
        });
      }

      console.log(`Stored ${reactionMessages.length} reactions for FID ${fid}`);
    } catch (error) {
      console.error(`Failed to backfill reactions for FID ${fid}:`, error);
      throw error;
    }
  }

  private async backfillLinks(fid: number): Promise<void> {
    try {
      const linkMessages = await this.hubClient.getAllLinksByFid(fid);

      if (linkMessages.length === 0) {
        console.log(`No links found for FID ${fid}`);
        return;
      }

      const linkRecords = linkMessages.map((message) =>
        createLinkRecordFromApiMessage(message)
      );

      if (linkRecords.length > 0) {
        await batchInsert(schema.links, linkRecords, {
          batchSize: 500,
          onConflictDoNothing: true,
        });
      }

      console.log(`Stored ${linkMessages.length} links for FID ${fid}`);
    } catch (error) {
      console.error(`Failed to backfill links for FID ${fid}:`, error);
      throw error;
    }
  }

  private async backfillVerifications(fid: number): Promise<void> {
    try {
      const verificationMessages =
        await this.hubClient.getAllVerificationsByFid(fid);

      if (verificationMessages.length === 0) {
        console.log(`No verifications found for FID ${fid}`);
        return;
      }

      const verificationRecords = verificationMessages.map((message) =>
        createVerificationRecordFromApiMessage(message)
      );

      if (verificationRecords.length > 0) {
        await batchInsert(schema.verifications, verificationRecords, {
          batchSize: 500,
          onConflictDoNothing: true,
        });
      }

      console.log(
        `Stored ${verificationMessages.length} verifications for FID ${fid}`
      );
    } catch (error) {
      console.error(`Failed to backfill verifications for FID ${fid}:`, error);
      throw error;
    }
  }

  private async backfillOnChainEvents(fid: number): Promise<void> {
    try {
      const onChainEventMessages =
        await this.hubClient.getAllOnChainSignersByFid(fid);

      if (onChainEventMessages.length === 0) {
        console.log(`No on-chain events found for FID ${fid}`);
        return;
      }

      const eventRecords = onChainEventMessages.map((event) =>
        createOnChainEventRecord(event)
      );

      if (eventRecords.length > 0) {
        await batchInsert(schema.onChainEvents, eventRecords, {
          batchSize: 500,
          onConflictDoNothing: true,
        });
      }

      console.log(
        `Stored ${onChainEventMessages.length} on-chain events for FID ${fid}`
      );
    } catch (error) {
      console.error(
        `Failed to backfill on-chain events for FID ${fid}:`,
        error
      );
      throw error;
    }
  }

  private async expandGraphFromRootTarget(fid: number): Promise<void> {
    try {
      console.log(`Expanding graph from root target FID ${fid}`);

      // Get all users this root target follows
      const followLinks = await db
        .select()
        .from(schema.links)
        .where(and(eq(schema.links.fid, fid), eq(schema.links.type, "follow")));

      console.log(
        `Found ${followLinks.length} follows for root target FID ${fid}`
      );

      // Add each followed user as a target (if not already exists)
      for (const link of followLinks) {
        const targetFid = link.targetFid;

        // Check if target already exists
        const existingTarget = await db
          .select()
          .from(schema.targets)
          .where(eq(schema.targets.fid, targetFid))
          .limit(1);

        if (existingTarget.length === 0) {
          // Add new target
          await db.insert(schema.targets).values({
            fid: targetFid,
            isRoot: false,
            addedAt: new Date(),
            lastSyncedAt: null,
          });

          // Add to Redis set
          await addTargetToSet(targetFid);

          // Schedule backfill job for this new target
          await scheduleBackfillJob(targetFid, false);

          console.log(
            `Added new target FID ${targetFid} and scheduled backfill`
          );
        }
      }

      console.log(`Graph expansion completed for root target FID ${fid}`);
    } catch (error) {
      console.error(
        `Failed to expand graph for root target FID ${fid}:`,
        error
      );
      throw error;
    }
  }

  private async markTargetAsSynced(fid: number): Promise<void> {
    try {
      await db
        .update(schema.targets)
        .set({ lastSyncedAt: new Date() })
        .where(eq(schema.targets.fid, fid));

      console.log(`Marked FID ${fid} as synced`);
    } catch (error) {
      console.error(`Failed to mark FID ${fid} as synced:`, error);
      throw error;
    }
  }
}

// Factory function to create worker processor
export function createBackfillProcessor(hubClient: HubClient) {
  const worker = new BackfillWorker(hubClient);

  return async (job: BackfillJob) => {
    await worker.processJob(job);
  };
}
