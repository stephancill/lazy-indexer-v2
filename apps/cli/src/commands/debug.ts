import { Command } from 'commander';
import { db, schema, HubClient, config } from '@farcaster-indexer/shared';
import { getAllQueueStats } from '@farcaster-indexer/indexer';
import { eq, desc, count } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { Redis } from 'ioredis';

const { targets, users, casts, reactions, links, verifications } = schema;

export const debugCommand = new Command('debug')
  .description('Debugging and inspection tools')
  .addCommand(
    new Command('target')
      .description('Debug specific target')
      .argument('<fid>', 'FID to debug')
      .option('--json', 'Output as JSON')
      .action(async (fid, options) => {
        try {
          const fidNum = parseInt(fid);
          if (isNaN(fidNum) || fidNum <= 0) {
            logger.error('FID must be a positive number');
            process.exit(1);
          }
          
          logger.startSpinner(`Debugging target ${fidNum}...`);
          
          // Get target info
          const targetInfo = await db
            .select()
            .from(targets)
            .where(eq(targets.fid, fidNum))
            .limit(1);
          
          if (targetInfo.length === 0) {
            logger.stopSpinner(false, `Target ${fidNum} not found`);
            process.exit(1);
          }
          
          const target = targetInfo[0];
          
          // Get user info
          const userInfo = await db
            .select()
            .from(users)
            .where(eq(users.fid, fidNum))
            .limit(1);
          
          // Get data counts
          const [castsCount] = await db.select({ count: count() }).from(casts).where(eq(casts.fid, fidNum));
          const [reactionsCount] = await db.select({ count: count() }).from(reactions).where(eq(reactions.fid, fidNum));
          const [linksCount] = await db.select({ count: count() }).from(links).where(eq(links.fid, fidNum));
          const [verificationsCount] = await db.select({ count: count() }).from(verifications).where(eq(verifications.fid, fidNum));
          
          // Get recent activity
          const recentCasts = await db
            .select({
              hash: casts.hash,
              text: casts.text,
              timestamp: casts.timestamp,
            })
            .from(casts)
            .where(eq(casts.fid, fidNum))
            .orderBy(desc(casts.timestamp))
            .limit(5);
          
          logger.stopSpinner(true, `Target ${fidNum} debug info retrieved`);
          
          const debugInfo = {
            target: {
              fid: target.fid,
              isRoot: target.isRoot,
              addedAt: target.addedAt,
              lastSyncedAt: target.lastSyncedAt,
            },
            user: userInfo.length > 0 ? {
              username: userInfo[0].username,
              displayName: userInfo[0].displayName,
              bio: userInfo[0].bio,
              custodyAddress: userInfo[0].custodyAddress,
              syncedAt: userInfo[0].syncedAt,
            } : null,
            counts: {
              casts: castsCount.count,
              reactions: reactionsCount.count,
              links: linksCount.count,
              verifications: verificationsCount.count,
            },
            recentActivity: recentCasts,
          };
          
          if (options.json) {
            logger.json(debugInfo);
          } else {
            logger.info(`Target FID: ${target.fid}`);
            logger.info(`Is Root: ${target.isRoot ? 'Yes' : 'No'}`);
            logger.info(`Added At: ${target.addedAt.toISOString()}`);
            logger.info(`Last Synced: ${target.lastSyncedAt ? target.lastSyncedAt.toISOString() : 'Never'}`);
            
            logger.line();
            
            if (userInfo.length > 0) {
              const user = userInfo[0];
              logger.info(`Username: ${user.username || 'N/A'}`);
              logger.info(`Display Name: ${user.displayName || 'N/A'}`);
              logger.info(`Bio: ${user.bio || 'N/A'}`);
              logger.info(`Custody Address: ${user.custodyAddress || 'N/A'}`);
              logger.info(`User Synced: ${user.syncedAt ? user.syncedAt.toISOString() : 'Never'}`);
            } else {
              logger.warn('No user profile data found');
            }
            
            logger.line();
            logger.table([{
              'Data Type': 'Casts',
              'Count': castsCount.count,
            }, {
              'Data Type': 'Reactions',
              'Count': reactionsCount.count,
            }, {
              'Data Type': 'Links',
              'Count': linksCount.count,
            }, {
              'Data Type': 'Verifications',
              'Count': verificationsCount.count,
            }]);
            
            if (recentCasts.length > 0) {
              logger.line();
              logger.info('Recent Casts:');
              recentCasts.forEach(cast => {
                logger.info(`  ${cast.timestamp.toISOString()}: ${cast.text?.substring(0, 100) || 'No text'}...`);
              });
            }
          }
        } catch (error) {
          logger.stopSpinner(false, `Failed to debug target ${fid}`);
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('hub')
      .description('Debug hub connection and fetch data')
      .argument('<fid>', 'FID to fetch from hub')
      .option('--type <type>', 'Data type to fetch (casts, reactions, links, verifications, user)', 'user')
      .option('--json', 'Output as JSON')
      .action(async (fid, options) => {
        try {
          const fidNum = parseInt(fid);
          if (isNaN(fidNum) || fidNum <= 0) {
            logger.error('FID must be a positive number');
            process.exit(1);
          }
          
          logger.startSpinner(`Fetching ${options.type} for FID ${fidNum} from hub...`);
          
          const hubClient = new HubClient(config.hubs);
          let data;
          
          // Note: Hub client methods need to be implemented in the shared package
          logger.warn('Hub client debug functionality not yet implemented');
          data = { message: `Debug for ${options.type} not yet available`, fid: fidNum };
          
          logger.stopSpinner(true, `Fetched ${options.type} for FID ${fidNum}`);
          
          if (options.json) {
            logger.json(data);
          } else {
            logger.info(`Data type: ${options.type}`);
            logger.info(`FID: ${fidNum}`);
            logger.info(`Results: ${Array.isArray(data) ? data.length : 1} items`);
            logger.line();
            
            if (Array.isArray(data)) {
              data.slice(0, 5).forEach((item, index) => {
                logger.info(`Item ${index + 1}:`);
                logger.json(item);
                logger.line();
              });
              
              if (data.length > 5) {
                logger.info(`... and ${data.length - 5} more items`);
              }
            } else {
              logger.json(data);
            }
          }
        } catch (error) {
          logger.stopSpinner(false, `Failed to fetch ${options.type} for FID ${fid}`);
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('redis')
      .description('Debug Redis cache contents')
      .option('--key <key>', 'Specific Redis key to inspect')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        try {
          logger.startSpinner('Inspecting Redis cache...');
          
          const redisClient = new Redis({
            host: config.redis.host,
            port: config.redis.port,
          });
          
          if (options.key) {
            const type = await redisClient.type(options.key);
            const ttl = await redisClient.ttl(options.key);
            
            let value;
            switch (type) {
              case 'string':
                value = await redisClient.get(options.key);
                break;
              case 'set':
                value = await redisClient.sMembers(options.key);
                break;
              case 'hash':
                value = await redisClient.hGetAll(options.key);
                break;
              case 'list':
                value = await redisClient.lRange(options.key, 0, -1);
                break;
              case 'zset':
                value = await redisClient.zRange(options.key, 0, -1, { withScores: true });
                break;
              default:
                value = 'Unsupported type';
            }
            
            logger.stopSpinner(true, `Redis key ${options.key} inspected`);
            
            if (options.json) {
              logger.json({ key: options.key, type, ttl, value });
            } else {
              logger.info(`Key: ${options.key}`);
              logger.info(`Type: ${type}`);
              logger.info(`TTL: ${ttl === -1 ? 'No expiration' : ttl === -2 ? 'Expired/Not exists' : `${ttl} seconds`}`);
              logger.info(`Value:`);
              logger.json(value);
            }
          } else {
            const keys = await redisClient.keys('*');
            const keyInfo = [];
            
            for (const key of keys.slice(0, 20)) {
              const type = await redisClient.type(key);
              const ttl = await redisClient.ttl(key);
              
              let size = 0;
              switch (type) {
                case 'string':
                  size = (await redisClient.get(key))?.length || 0;
                  break;
                case 'set':
                  size = await redisClient.sCard(key);
                  break;
                case 'hash':
                  size = await redisClient.hLen(key);
                  break;
                case 'list':
                  size = await redisClient.lLen(key);
                  break;
                case 'zset':
                  size = await redisClient.zCard(key);
                  break;
              }
              
              keyInfo.push({ key, type, ttl, size });
            }
            
            logger.stopSpinner(true, `Found ${keys.length} Redis keys`);
            
            if (options.json) {
              logger.json({ totalKeys: keys.length, keys: keyInfo });
            } else {
              logger.info(`Total keys: ${keys.length}`);
              logger.line();
              
              if (keyInfo.length > 0) {
                logger.table(keyInfo.map(info => ({
                  Key: info.key,
                  Type: info.type,
                  'TTL (seconds)': info.ttl === -1 ? 'No expiration' : info.ttl === -2 ? 'Expired/Not exists' : info.ttl,
                  Size: info.size,
                })));
                
                if (keys.length > 20) {
                  logger.info(`... and ${keys.length - 20} more keys`);
                }
              }
            }
          }
          
          await redisClient.quit();
        } catch (error) {
          logger.stopSpinner(false, 'Failed to inspect Redis cache');
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('queues')
      .description('Debug queue system status')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        try {
          logger.startSpinner('Debugging queue system...');
          
          const queueStats = await getAllQueueStats();
          
          logger.stopSpinner(true, 'Queue system debug info retrieved');
          
          if (options.json) {
            logger.json(queueStats);
          } else {
            logger.info('Queue System Status:');
            logger.line();
            
            queueStats.forEach(stat => {
              logger.info(`Queue: ${stat.queue}`);
              logger.info(`  Status: ${stat.paused ? 'Paused' : 'Running'}`);
              logger.info(`  Waiting Jobs: ${stat.waiting}`);
              logger.info(`  Active Jobs: ${stat.active}`);
              logger.info(`  Completed Jobs: ${stat.completed}`);
              logger.info(`  Failed Jobs: ${stat.failed}`);
              logger.info(`  Delayed Jobs: ${stat.delayed}`);
              logger.line();
            });
            
            const hasIssues = queueStats.some(stat => stat.failed > 0 || stat.paused > 0);
            if (hasIssues) {
              logger.warn('Issues detected in queue system');
            } else {
              logger.success('Queue system appears healthy');
            }
          }
        } catch (error) {
          logger.stopSpinner(false, 'Failed to debug queue system');
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      })
  );