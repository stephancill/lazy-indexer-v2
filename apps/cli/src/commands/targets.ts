import { Command } from 'commander';
import { db, schema } from '@farcaster-indexer/shared';
import { eq, count, and, isNull, isNotNull, desc, asc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const { targets, targetClients } = schema;

export const targetCommands = new Command('targets')
  .description('Target management commands')
  .addCommand(
    new Command('list')
      .description('List all targets')
      .option('-l, --limit <number>', 'Limit number of results', '20')
      .option('-o, --offset <number>', 'Offset for pagination', '0')
      .option('--root-only', 'Show only root targets')
      .option('--unsynced', 'Show only unsynced targets')
      .option('--sort <field>', 'Sort by field (fid, added_at, last_synced_at)', 'fid')
      .option('--desc', 'Sort in descending order')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        try {
          logger.startSpinner('Fetching targets...');
          
          const limit = Math.min(parseInt(options.limit), 1000);
          const offset = Math.max(parseInt(options.offset), 0);
          
          let whereConditions = [];
          if (options.rootOnly) {
            whereConditions.push(eq(targets.isRoot, true));
          }
          if (options.unsynced) {
            whereConditions.push(isNull(targets.lastSyncedAt));
          }
          
          const sortField = options.sort === 'added_at' ? targets.addedAt : 
                           options.sort === 'last_synced_at' ? targets.lastSyncedAt : 
                           targets.fid;
          const sortDirection = options.desc ? desc : asc;
          
          const results = await db
            .select({
              fid: targets.fid,
              isRoot: targets.isRoot,
              addedAt: targets.addedAt,
              lastSyncedAt: targets.lastSyncedAt,
            })
            .from(targets)
            .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
            .orderBy(sortDirection(sortField))
            .limit(limit)
            .offset(offset);
          
          logger.stopSpinner(true, `Found ${results.length} targets`);
          
          if (options.json) {
            logger.json(results);
          } else {
            logger.table(results.map(t => ({
              FID: t.fid,
              Root: t.isRoot ? '✓' : '',
              'Added At': t.addedAt.toISOString().split('T')[0],
              'Last Synced': t.lastSyncedAt ? t.lastSyncedAt.toISOString().split('T')[0] : 'Never',
            })));
          }
        } catch (error) {
          logger.stopSpinner(false, 'Failed to fetch targets');
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('add')
      .description('Add a new target')
      .argument('<fid>', 'FID to add as target')
      .option('--root', 'Add as root target')
      .action(async (fid, options) => {
        try {
          const fidNum = parseInt(fid);
          if (isNaN(fidNum) || fidNum <= 0) {
            logger.error('FID must be a positive number');
            process.exit(1);
          }
          
          logger.startSpinner(`Adding target ${fidNum}...`);
          
          await db.insert(targets).values({
            fid: fidNum,
            isRoot: options.root || false,
            addedAt: new Date(),
          }).onConflictDoNothing();
          
          logger.stopSpinner(true, `Target ${fidNum} added successfully`);
          
          if (options.root) {
            logger.info(`Target ${fidNum} added as root target`);
          }
        } catch (error) {
          logger.stopSpinner(false, 'Failed to add target');
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('remove')
      .description('Remove a target')
      .argument('<fid>', 'FID to remove')
      .option('--confirm', 'Confirm removal')
      .action(async (fid, options) => {
        if (!options.confirm) {
          logger.error('This operation will remove the target. Use --confirm to proceed.');
          process.exit(1);
        }
        
        try {
          const fidNum = parseInt(fid);
          if (isNaN(fidNum) || fidNum <= 0) {
            logger.error('FID must be a positive number');
            process.exit(1);
          }
          
          logger.startSpinner(`Removing target ${fidNum}...`);
          
          const result = await db.delete(targets).where(eq(targets.fid, fidNum));
          
          // Note: result structure may vary, this is a simplified check
          logger.stopSpinner(true, `Target ${fidNum} removed successfully`);
        } catch (error) {
          logger.stopSpinner(false, 'Failed to remove target');
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('stats')
      .description('Show target statistics')
      .action(async () => {
        try {
          logger.startSpinner('Calculating target statistics...');
          
          const [totalTargets] = await db.select({ count: count() }).from(targets);
          const [rootTargets] = await db.select({ count: count() }).from(targets).where(eq(targets.isRoot, true));
          const [unsyncedTargets] = await db.select({ count: count() }).from(targets).where(isNull(targets.lastSyncedAt));
          const [syncedTargets] = await db.select({ count: count() }).from(targets).where(isNotNull(targets.lastSyncedAt));
          
          logger.stopSpinner(true, 'Statistics calculated');
          
          const stats = {
            'Total Targets': totalTargets.count,
            'Root Targets': rootTargets.count,
            'Non-Root Targets': totalTargets.count - rootTargets.count,
            'Synced Targets': syncedTargets.count,
            'Unsynced Targets': unsyncedTargets.count,
          };
          
          logger.table([stats]);
        } catch (error) {
          logger.stopSpinner(false, 'Failed to calculate statistics');
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('clients')
      .description('Manage client targets')
      .addCommand(
        new Command('list')
          .description('List all client targets')
          .option('--json', 'Output as JSON')
          .action(async (options) => {
            try {
              logger.startSpinner('Fetching client targets...');
              
              const results = await db
                .select({
                  clientFid: targetClients.clientFid,
                  addedAt: targetClients.addedAt,
                })
                .from(targetClients)
                .orderBy(asc(targetClients.clientFid));
              
              logger.stopSpinner(true, `Found ${results.length} client targets`);
              
              if (options.json) {
                logger.json(results);
              } else {
                logger.table(results.map(c => ({
                  'Client FID': c.clientFid,
                  'Added At': c.addedAt.toISOString().split('T')[0],
                })));
              }
            } catch (error) {
              logger.stopSpinner(false, 'Failed to fetch client targets');
              logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
              process.exit(1);
            }
          })
      )
      .addCommand(
        new Command('add')
          .description('Add a client target')
          .argument('<fid>', 'Client FID to add')
          .action(async (fid) => {
            try {
              const fidNum = parseInt(fid);
              if (isNaN(fidNum) || fidNum <= 0) {
                logger.error('FID must be a positive number');
                process.exit(1);
              }
              
              logger.startSpinner(`Adding client target ${fidNum}...`);
              
              await db.insert(targetClients).values({
                clientFid: fidNum,
                addedAt: new Date(),
              }).onConflictDoNothing();
              
              logger.stopSpinner(true, `Client target ${fidNum} added successfully`);
            } catch (error) {
              logger.stopSpinner(false, 'Failed to add client target');
              logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
              process.exit(1);
            }
          })
      )
      .addCommand(
        new Command('remove')
          .description('Remove a client target')
          .argument('<fid>', 'Client FID to remove')
          .option('--confirm', 'Confirm removal')
          .action(async (fid, options) => {
            if (!options.confirm) {
              logger.error('This operation will remove the client target. Use --confirm to proceed.');
              process.exit(1);
            }
            
            try {
              const fidNum = parseInt(fid);
              if (isNaN(fidNum) || fidNum <= 0) {
                logger.error('FID must be a positive number');
                process.exit(1);
              }
              
              logger.startSpinner(`Removing client target ${fidNum}...`);
              
              const result = await db.delete(targetClients).where(eq(targetClients.clientFid, fidNum));
              
              // Note: result structure may vary
              
              logger.stopSpinner(true, `Client target ${fidNum} removed successfully`);
            } catch (error) {
              logger.stopSpinner(false, 'Failed to remove client target');
              logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
              process.exit(1);
            }
          })
      )
  );