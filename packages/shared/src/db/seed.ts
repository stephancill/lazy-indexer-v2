import { db } from './index.js';
import { schema } from './schema.js';
import { config } from '../config.js';

// Sample data for testing and development
const sampleUsers = [
  {
    fid: 1,
    username: 'alice',
    displayName: 'Alice',
    pfpUrl: 'https://i.imgur.com/alice.jpg',
    bio: 'Building the future of decentralized social media',
    custodyAddress: '0x1234567890abcdef1234567890abcdef12345678',
    syncedAt: new Date(),
  },
  {
    fid: 2,
    username: 'bob',
    displayName: 'Bob',
    pfpUrl: 'https://i.imgur.com/bob.jpg',
    bio: 'Crypto enthusiast and developer',
    custodyAddress: '0x2234567890abcdef1234567890abcdef23456789',
    syncedAt: new Date(),
  },
  {
    fid: 3,
    username: 'charlie',
    displayName: 'Charlie',
    pfpUrl: 'https://i.imgur.com/charlie.jpg',
    bio: 'NFT collector and artist',
    custodyAddress: '0x3234567890abcdef1234567890abcdef34567890',
    syncedAt: new Date(),
  },
];

const sampleCasts = [
  {
    hash: 'cast1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fid: 1,
    text: 'Welcome to the future of decentralized social media! 🚀',
    timestamp: new Date(Date.now() - 3600000), // 1 hour ago
    embeds: [{ url: 'https://farcaster.xyz' }],
    mentions: [2, 3],
    mentionsPositions: [50, 60],
  },
  {
    hash: 'cast2234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fid: 2,
    text: 'Just deployed my first smart contract! 💯',
    timestamp: new Date(Date.now() - 7200000), // 2 hours ago
    embeds: [{ url: 'https://etherscan.io/tx/0x123' }],
    mentions: [1],
    mentionsPositions: [45],
  },
  {
    hash: 'cast3234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fid: 3,
    text: 'Check out this amazing NFT collection 🎨',
    parentHash: 'cast1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    parentFid: 1,
    timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
    embeds: [{ url: 'https://opensea.io/collection/test' }],
    mentions: [1],
    mentionsPositions: [0],
  },
];

const sampleReactions = [
  {
    hash: 'reaction1234567890abcdef1234567890abcdef1234567890abcdef123456',
    fid: 2,
    type: 'like',
    targetHash: 'cast1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    targetFid: 1,
    timestamp: new Date(Date.now() - 3000000), // 50 minutes ago
  },
  {
    hash: 'reaction2234567890abcdef1234567890abcdef1234567890abcdef123456',
    fid: 3,
    type: 'recast',
    targetHash: 'cast2234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    targetFid: 2,
    timestamp: new Date(Date.now() - 5400000), // 90 minutes ago
  },
];

const sampleLinks = [
  {
    hash: 'link1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fid: 1,
    targetFid: 2,
    type: 'follow',
    timestamp: new Date(Date.now() - 86400000), // 1 day ago
  },
  {
    hash: 'link2234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fid: 1,
    targetFid: 3,
    type: 'follow',
    timestamp: new Date(Date.now() - 86400000), // 1 day ago
  },
  {
    hash: 'link3234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fid: 2,
    targetFid: 1,
    type: 'follow',
    timestamp: new Date(Date.now() - 82800000), // 23 hours ago
  },
];

const sampleVerifications = [
  {
    hash: 'verify1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fid: 1,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    protocol: 'ethereum',
    timestamp: new Date(Date.now() - 172800000), // 2 days ago
  },
  {
    hash: 'verify2234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    fid: 2,
    address: '0x2234567890abcdef1234567890abcdef23456789',
    protocol: 'ethereum',
    timestamp: new Date(Date.now() - 259200000), // 3 days ago
  },
];

const sampleUserData = [
  {
    hash: 'userdata1234567890abcdef1234567890abcdef1234567890abcdef123456',
    fid: 1,
    type: 'display',
    value: 'Alice',
    timestamp: new Date(Date.now() - 259200000), // 3 days ago
  },
  {
    hash: 'userdata2234567890abcdef1234567890abcdef1234567890abcdef123456',
    fid: 1,
    type: 'bio',
    value: 'Building the future of decentralized social media',
    timestamp: new Date(Date.now() - 259200000), // 3 days ago
  },
  {
    hash: 'userdata3234567890abcdef1234567890abcdef1234567890abcdef123456',
    fid: 2,
    type: 'display',
    value: 'Bob',
    timestamp: new Date(Date.now() - 345600000), // 4 days ago
  },
];

const sampleOnChainEvents = [
  {
    type: 'SIGNER_ADD',
    chainId: 10,
    blockNumber: 123456,
    blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    blockTimestamp: new Date(Date.now() - 604800000), // 1 week ago
    transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    logIndex: 0,
    fid: 1,
    signerEventBody: {
      key: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      keyType: 1,
      eventType: 'ADD',
      metadata: '0x',
      metadataType: 1,
    },
  },
  {
    type: 'ID_REGISTER',
    chainId: 10,
    blockNumber: 123450,
    blockHash: '0xbcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678901',
    blockTimestamp: new Date(Date.now() - 1209600000), // 2 weeks ago
    transactionHash: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    logIndex: 0,
    fid: 1,
    idRegistryEventBody: {
      to: '0x1234567890abcdef1234567890abcdef12345678',
      eventType: 'REGISTER',
      from: '0x0000000000000000000000000000000000000000',
      recovery: '0x1234567890abcdef1234567890abcdef12345678',
    },
  },
];

export async function seedDevelopmentData() {
  console.log('🌱 Seeding development data...');

  try {
    // Insert targets (from config + sample users)
    const rootTargets = config.strategy.rootTargets.map(fid => ({
      fid,
      isRoot: true,
      addedAt: new Date(),
    }));

    const additionalTargets = sampleUsers.map(user => ({
      fid: user.fid,
      isRoot: rootTargets.some(t => t.fid === user.fid),
      addedAt: new Date(),
    }));

    const allTargets = [...rootTargets];
    additionalTargets.forEach(target => {
      if (!allTargets.some(t => t.fid === target.fid)) {
        allTargets.push(target);
      }
    });

    await db.insert(schema.targets).values(allTargets).onConflictDoNothing();
    console.log(`✅ Inserted ${allTargets.length} targets`);

    // Insert target clients
    if (config.strategy.targetClients.length > 0) {
      const clientTargets = config.strategy.targetClients.map(clientFid => ({
        clientFid,
        addedAt: new Date(),
      }));

      await db.insert(schema.targetClients).values(clientTargets).onConflictDoNothing();
      console.log(`✅ Inserted ${clientTargets.length} target clients`);
    }

    // Insert sample users
    await db.insert(schema.users).values(sampleUsers).onConflictDoNothing();
    console.log(`✅ Inserted ${sampleUsers.length} users`);

    // Insert sample casts
    await db.insert(schema.casts).values(sampleCasts).onConflictDoNothing();
    console.log(`✅ Inserted ${sampleCasts.length} casts`);

    // Insert sample reactions
    await db.insert(schema.reactions).values(sampleReactions).onConflictDoNothing();
    console.log(`✅ Inserted ${sampleReactions.length} reactions`);

    // Insert sample links
    await db.insert(schema.links).values(sampleLinks).onConflictDoNothing();
    console.log(`✅ Inserted ${sampleLinks.length} links`);

    // Insert sample verifications
    await db.insert(schema.verifications).values(sampleVerifications).onConflictDoNothing();
    console.log(`✅ Inserted ${sampleVerifications.length} verifications`);

    // Insert sample user data
    await db.insert(schema.userData).values(sampleUserData).onConflictDoNothing();
    console.log(`✅ Inserted ${sampleUserData.length} user data records`);

    // Insert sample on-chain events
    await db.insert(schema.onChainEvents).values(sampleOnChainEvents).onConflictDoNothing();
    console.log(`✅ Inserted ${sampleOnChainEvents.length} on-chain events`);

    // Insert initial sync state
    const initialSyncState = [
      {
        name: 'realtime-sync',
        lastEventId: 0,
        lastSyncedAt: new Date(),
      },
      {
        name: 'backfill-queue',
        lastEventId: 0,
        lastSyncedAt: new Date(),
      },
    ];

    await db.insert(schema.syncState).values(initialSyncState).onConflictDoNothing();
    console.log(`✅ Inserted ${initialSyncState.length} sync state records`);

    console.log('🎉 Development data seeded successfully!');
  } catch (error) {
    console.error('❌ Failed to seed development data:', error);
    throw error;
  }
}

export async function seedTestData() {
  console.log('🧪 Seeding test data...');

  try {
    const testTargets = [
      { fid: 1, isRoot: true, addedAt: new Date() },
      { fid: 2, isRoot: false, addedAt: new Date() },
    ];

    const testUsers = [
      { fid: 1, username: 'testuser1', displayName: 'Test User 1', syncedAt: new Date() },
      { fid: 2, username: 'testuser2', displayName: 'Test User 2', syncedAt: new Date() },
    ];

    await db.insert(schema.targets).values(testTargets).onConflictDoNothing();
    await db.insert(schema.users).values(testUsers).onConflictDoNothing();

    console.log('✅ Test data seeded successfully!');
  } catch (error) {
    console.error('❌ Failed to seed test data:', error);
    throw error;
  }
}

export async function cleanupData() {
  console.log('🧹 Cleaning up data...');

  try {
    // Clean up in reverse order of dependencies
    await db.delete(schema.syncState);
    await db.delete(schema.onChainEvents);
    await db.delete(schema.usernameProofs);
    await db.delete(schema.userData);
    await db.delete(schema.verifications);
    await db.delete(schema.links);
    await db.delete(schema.reactions);
    await db.delete(schema.casts);
    await db.delete(schema.users);
    await db.delete(schema.targetClients);
    await db.delete(schema.targets);

    console.log('✅ Data cleanup completed!');
  } catch (error) {
    console.error('❌ Failed to cleanup data:', error);
    throw error;
  }
}

export async function getDataStats() {
  console.log('📊 Getting data statistics...');

  try {
    const stats = await Promise.all([
      db.select().from(schema.targets).then(rows => ({ table: 'targets', count: rows.length })),
      db.select().from(schema.targetClients).then(rows => ({ table: 'target_clients', count: rows.length })),
      db.select().from(schema.users).then(rows => ({ table: 'users', count: rows.length })),
      db.select().from(schema.casts).then(rows => ({ table: 'casts', count: rows.length })),
      db.select().from(schema.reactions).then(rows => ({ table: 'reactions', count: rows.length })),
      db.select().from(schema.links).then(rows => ({ table: 'links', count: rows.length })),
      db.select().from(schema.verifications).then(rows => ({ table: 'verifications', count: rows.length })),
      db.select().from(schema.userData).then(rows => ({ table: 'user_data', count: rows.length })),
      db.select().from(schema.usernameProofs).then(rows => ({ table: 'username_proofs', count: rows.length })),
      db.select().from(schema.onChainEvents).then(rows => ({ table: 'on_chain_events', count: rows.length })),
      db.select().from(schema.syncState).then(rows => ({ table: 'sync_state', count: rows.length })),
    ]);

    console.table(stats);
    return stats;
  } catch (error) {
    console.error('❌ Failed to get data statistics:', error);
    throw error;
  }
}