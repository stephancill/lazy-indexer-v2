import { Command } from 'commander';
import { db, schema } from '@farcaster-indexer/shared';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

const { targets, targetClients, users, casts, reactions, links, verifications } = schema;

export const exportCommand = new Command('export')
  .description('Export data from the database')
  .option('--table <table>', 'Specific table to export (targets, users, casts, reactions, links, verifications)', 'all')
  .option('--fids <fids>', 'Comma-separated list of FIDs to export (for user-specific data)')
  .option('--format <format>', 'Export format (json, csv)', 'json')
  .option('--output <file>', 'Output file path', 'export.json')
  .option('--limit <number>', 'Limit number of records per table', '0')
  .action(async (options) => {
    try {
      logger.startSpinner('Exporting data...');
      
      const exportData: any = {
        exportedAt: new Date().toISOString(),
        tables: {},
      };
      
      const limit = parseInt(options.limit) || undefined;
      const fidList = options.fids ? options.fids.split(',').map((f: string) => parseInt(f.trim())).filter((f: number) => !isNaN(f)) : undefined;
      
      // Export targets
      if (options.table === 'all' || options.table === 'targets') {
        logger.updateSpinner('Exporting targets...');
        let query = db.select().from(targets);
        if (fidList && fidList.length > 0) {
          query = query.where(inArray(targets.fid, fidList));
        }
        if (limit) {
          query = query.limit(limit);
        }
        exportData.tables.targets = await query;
      }
      
      // Export target clients
      if (options.table === 'all' || options.table === 'target_clients') {
        logger.updateSpinner('Exporting target clients...');
        let query = db.select().from(targetClients);
        if (limit) {
          query = query.limit(limit);
        }
        exportData.tables.target_clients = await query;
      }
      
      // Export users
      if (options.table === 'all' || options.table === 'users') {
        logger.updateSpinner('Exporting users...');
        let query = db.select().from(users);
        if (fidList && fidList.length > 0) {
          query = query.where(inArray(users.fid, fidList));
        }
        if (limit) {
          query = query.limit(limit);
        }
        exportData.tables.users = await query;
      }
      
      // Export casts
      if (options.table === 'all' || options.table === 'casts') {
        logger.updateSpinner('Exporting casts...');
        let query = db.select().from(casts);
        if (fidList && fidList.length > 0) {
          query = query.where(inArray(casts.fid, fidList));
        }
        if (limit) {
          query = query.limit(limit);
        }
        exportData.tables.casts = await query;
      }
      
      // Export reactions
      if (options.table === 'all' || options.table === 'reactions') {
        logger.updateSpinner('Exporting reactions...');
        let query = db.select().from(reactions);
        if (fidList && fidList.length > 0) {
          query = query.where(inArray(reactions.fid, fidList));
        }
        if (limit) {
          query = query.limit(limit);
        }
        exportData.tables.reactions = await query;
      }
      
      // Export links
      if (options.table === 'all' || options.table === 'links') {
        logger.updateSpinner('Exporting links...');
        let query = db.select().from(links);
        if (fidList && fidList.length > 0) {
          query = query.where(inArray(links.fid, fidList));
        }
        if (limit) {
          query = query.limit(limit);
        }
        exportData.tables.links = await query;
      }
      
      // Export verifications
      if (options.table === 'all' || options.table === 'verifications') {
        logger.updateSpinner('Exporting verifications...');
        let query = db.select().from(verifications);
        if (fidList && fidList.length > 0) {
          query = query.where(inArray(verifications.fid, fidList));
        }
        if (limit) {
          query = query.limit(limit);
        }
        exportData.tables.verifications = await query;
      }
      
      // Format and write output
      logger.updateSpinner('Writing export file...');
      
      if (options.format === 'csv') {
        logger.error('CSV format not yet implemented. Use JSON format.');
        process.exit(1);
      } else {
        await writeFile(options.output, JSON.stringify(exportData, null, 2));
      }
      
      const totalRecords = Object.values(exportData.tables).reduce((sum: number, table: any) => sum + (Array.isArray(table) ? table.length : 0), 0);
      
      logger.stopSpinner(true, `Exported ${totalRecords} records to ${options.output}`);
      
      // Show export summary
      const summary = Object.entries(exportData.tables).map(([table, data]) => ({
        Table: table,
        Records: Array.isArray(data) ? data.length : 0,
      }));
      
      logger.table(summary);
    } catch (error) {
      logger.stopSpinner(false, 'Export failed');
      logger.error(`Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

export const importCommand = new Command('import')
  .description('Import data into the database')
  .argument('<file>', 'Import file path')
  .option('--table <table>', 'Specific table to import (targets, users, casts, reactions, links, verifications)', 'all')
  .option('--replace', 'Replace existing records (use with caution)')
  .option('--dry-run', 'Show what would be imported without actually importing')
  .action(async (file, options) => {
    try {
      if (!existsSync(file)) {
        logger.error(`File not found: ${file}`);
        process.exit(1);
      }
      
      logger.startSpinner('Reading import file...');
      
      const fileContent = await readFile(file, 'utf-8');
      const importData = JSON.parse(fileContent);
      
      if (!importData.tables || typeof importData.tables !== 'object') {
        logger.error('Invalid import file format. Expected JSON with "tables" object.');
        process.exit(1);
      }
      
      logger.stopSpinner(true, 'Import file loaded');
      
      if (options.dryRun) {
        logger.info('DRY RUN - No data will be imported');
      }
      
      const summary = [];
      
      // Import targets
      if ((options.table === 'all' || options.table === 'targets') && importData.tables.targets) {
        const records = importData.tables.targets;
        summary.push({ table: 'targets', records: records.length });
        
        if (!options.dryRun) {
          logger.updateSpinner(`Importing ${records.length} targets...`);
          
          if (options.replace) {
            await db.delete(targets);
          }
          
          for (const record of records) {
            await db.insert(targets).values({
              fid: record.fid,
              isRoot: record.isRoot,
              addedAt: new Date(record.addedAt),
              lastSyncedAt: record.lastSyncedAt ? new Date(record.lastSyncedAt) : null,
            }).onConflictDoNothing();
          }
        }
      }
      
      // Import target clients
      if ((options.table === 'all' || options.table === 'target_clients') && importData.tables.target_clients) {
        const records = importData.tables.target_clients;
        summary.push({ table: 'target_clients', records: records.length });
        
        if (!options.dryRun) {
          logger.updateSpinner(`Importing ${records.length} target clients...`);
          
          if (options.replace) {
            await db.delete(targetClients);
          }
          
          for (const record of records) {
            await db.insert(targetClients).values({
              clientFid: record.clientFid,
              addedAt: new Date(record.addedAt),
            }).onConflictDoNothing();
          }
        }
      }
      
      // Import users
      if ((options.table === 'all' || options.table === 'users') && importData.tables.users) {
        const records = importData.tables.users;
        summary.push({ table: 'users', records: records.length });
        
        if (!options.dryRun) {
          logger.updateSpinner(`Importing ${records.length} users...`);
          
          if (options.replace) {
            await db.delete(users);
          }
          
          for (const record of records) {
            await db.insert(users).values({
              fid: record.fid,
              username: record.username,
              displayName: record.displayName,
              pfpUrl: record.pfpUrl,
              bio: record.bio,
              custodyAddress: record.custodyAddress,
              syncedAt: new Date(record.syncedAt),
            }).onConflictDoUpdate({
              target: users.fid,
              set: {
                username: record.username,
                displayName: record.displayName,
                pfpUrl: record.pfpUrl,
                bio: record.bio,
                custodyAddress: record.custodyAddress,
                syncedAt: new Date(record.syncedAt),
              },
            });
          }
        }
      }
      
      // Import casts
      if ((options.table === 'all' || options.table === 'casts') && importData.tables.casts) {
        const records = importData.tables.casts;
        summary.push({ table: 'casts', records: records.length });
        
        if (!options.dryRun) {
          logger.updateSpinner(`Importing ${records.length} casts...`);
          
          if (options.replace) {
            await db.delete(casts);
          }
          
          for (const record of records) {
            await db.insert(casts).values({
              hash: record.hash,
              fid: record.fid,
              text: record.text,
              parentHash: record.parentHash,
              parentFid: record.parentFid,
              parentUrl: record.parentUrl,
              timestamp: new Date(record.timestamp),
              embeds: record.embeds,
            }).onConflictDoNothing();
          }
        }
      }
      
      // Import reactions
      if ((options.table === 'all' || options.table === 'reactions') && importData.tables.reactions) {
        const records = importData.tables.reactions;
        summary.push({ table: 'reactions', records: records.length });
        
        if (!options.dryRun) {
          logger.updateSpinner(`Importing ${records.length} reactions...`);
          
          if (options.replace) {
            await db.delete(reactions);
          }
          
          for (const record of records) {
            await db.insert(reactions).values({
              hash: record.hash,
              fid: record.fid,
              type: record.type,
              targetHash: record.targetHash,
              timestamp: new Date(record.timestamp),
            }).onConflictDoNothing();
          }
        }
      }
      
      // Import links
      if ((options.table === 'all' || options.table === 'links') && importData.tables.links) {
        const records = importData.tables.links;
        summary.push({ table: 'links', records: records.length });
        
        if (!options.dryRun) {
          logger.updateSpinner(`Importing ${records.length} links...`);
          
          if (options.replace) {
            await db.delete(links);
          }
          
          for (const record of records) {
            await db.insert(links).values({
              hash: record.hash,
              fid: record.fid,
              targetFid: record.targetFid,
              type: record.type,
              timestamp: new Date(record.timestamp),
            }).onConflictDoNothing();
          }
        }
      }
      
      // Import verifications
      if ((options.table === 'all' || options.table === 'verifications') && importData.tables.verifications) {
        const records = importData.tables.verifications;
        summary.push({ table: 'verifications', records: records.length });
        
        if (!options.dryRun) {
          logger.updateSpinner(`Importing ${records.length} verifications...`);
          
          if (options.replace) {
            await db.delete(verifications);
          }
          
          for (const record of records) {
            await db.insert(verifications).values({
              hash: record.hash,
              fid: record.fid,
              address: record.address,
              protocol: record.protocol,
              timestamp: new Date(record.timestamp),
            }).onConflictDoNothing();
          }
        }
      }
      
      const totalRecords = summary.reduce((sum, item) => sum + item.records, 0);
      
      if (options.dryRun) {
        logger.success(`DRY RUN: Would import ${totalRecords} records`);
      } else {
        logger.stopSpinner(true, `Imported ${totalRecords} records successfully`);
      }
      
      logger.table(summary.map(item => ({
        Table: item.table,
        Records: item.records,
      })));
      
      if (options.replace && !options.dryRun) {
        logger.warn('Data was replaced. Previous records in imported tables were deleted.');
      }
    } catch (error) {
      logger.stopSpinner(false, 'Import failed');
      logger.error(`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });