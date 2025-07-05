/**
 * Database optimization utilities for the Farcaster Indexer
 *
 * This module provides database optimization strategies including
 * custom indexes, query optimization, and performance analysis.
 */

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Advanced database indexes for performance optimization
 */
export const ADVANCED_INDEXES = {
  // Feed query optimization - frequently used for user feeds
  FEED_OPTIMIZATION: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS casts_feed_idx 
    ON casts (fid, timestamp DESC) 
    WHERE timestamp > NOW() - INTERVAL '30 days';
  `,

  // Recent activity index - for real-time features
  RECENT_ACTIVITY: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS recent_activity_idx 
    ON casts (timestamp DESC) 
    WHERE timestamp > NOW() - INTERVAL '24 hours';
  `,

  // User engagement optimization
  USER_ENGAGEMENT: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS user_engagement_idx 
    ON reactions (target_fid, type, timestamp DESC);
  `,

  // Follow graph optimization
  FOLLOW_GRAPH: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS follow_graph_idx 
    ON links (fid, target_fid, type) 
    WHERE type = 'follow';
  `,

  // Search optimization for text content
  TEXT_SEARCH: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS casts_text_search_idx 
    ON casts USING gin(to_tsvector('english', text)) 
    WHERE text IS NOT NULL;
  `,

  // Hash lookup optimization
  HASH_LOOKUP: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS casts_hash_prefix_idx 
    ON casts (substring(hash, 1, 8));
  `,

  // Target management optimization
  TARGET_SYNC: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS targets_sync_status_idx 
    ON targets (is_root, last_synced_at NULLS FIRST);
  `,

  // User data optimization
  USER_DATA_LOOKUP: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS user_data_type_value_idx 
    ON user_data (fid, type, value) 
    WHERE type IN ('username', 'display', 'pfp');
  `,

  // On-chain events optimization
  ONCHAIN_EVENTS: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS onchain_events_block_idx 
    ON on_chain_events (chain_id, block_number DESC, log_index);
  `,

  // Verification lookup optimization
  VERIFICATION_ADDRESS: `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS verifications_address_protocol_idx 
    ON verifications (address, protocol);
  `,
} as const;

/**
 * Optimized view definitions for common queries
 */
export const OPTIMIZED_VIEWS = {
  // User feed view - pre-computed for performance
  USER_FEED: `
    CREATE OR REPLACE VIEW user_feed AS
    SELECT 
      c.hash,
      c.fid,
      c.text,
      c.timestamp,
      c.embeds,
      c.parent_hash,
      c.parent_fid,
      u.username,
      u.display_name,
      u.pfp_url
    FROM casts c
    JOIN users u ON c.fid = u.fid
    WHERE c.timestamp > NOW() - INTERVAL '7 days'
    ORDER BY c.timestamp DESC;
  `,

  // User engagement summary
  USER_ENGAGEMENT_SUMMARY: `
    CREATE OR REPLACE VIEW user_engagement_summary AS
    SELECT 
      fid,
      COUNT(*) FILTER (WHERE type = 'like') as likes_given,
      COUNT(*) FILTER (WHERE type = 'recast') as recasts_given
    FROM reactions
    WHERE timestamp > NOW() - INTERVAL '30 days'
    GROUP BY fid;
  `,

  // Follow recommendations view
  FOLLOW_RECOMMENDATIONS: `
    CREATE OR REPLACE VIEW follow_recommendations AS
    WITH user_follows AS (
      SELECT fid, target_fid 
      FROM links 
      WHERE type = 'follow'
    ),
    mutual_follows AS (
      SELECT 
        uf1.fid as user_fid,
        uf2.target_fid as recommended_fid,
        COUNT(*) as mutual_count
      FROM user_follows uf1
      JOIN user_follows uf2 ON uf1.target_fid = uf2.fid
      WHERE uf1.fid != uf2.target_fid
      AND NOT EXISTS (
        SELECT 1 FROM user_follows uf3 
        WHERE uf3.fid = uf1.fid AND uf3.target_fid = uf2.target_fid
      )
      GROUP BY uf1.fid, uf2.target_fid
    )
    SELECT 
      user_fid,
      recommended_fid,
      mutual_count,
      u.username as recommended_username,
      u.display_name as recommended_display_name
    FROM mutual_follows mf
    JOIN users u ON mf.recommended_fid = u.fid
    WHERE mutual_count >= 2
    ORDER BY user_fid, mutual_count DESC;
  `,

  // Trending casts view
  TRENDING_CASTS: `
    CREATE OR REPLACE VIEW trending_casts AS
    WITH cast_scores AS (
      SELECT 
        c.hash,
        c.fid,
        c.text,
        c.timestamp,
        u.username,
        u.display_name,
        COUNT(r.hash) FILTER (WHERE r.type = 'like') as likes,
        COUNT(r.hash) FILTER (WHERE r.type = 'recast') as recasts,
        COUNT(replies.hash) as replies,
        -- Simple engagement score
        (COUNT(r.hash) FILTER (WHERE r.type = 'like') * 1 +
         COUNT(r.hash) FILTER (WHERE r.type = 'recast') * 3 +
         COUNT(replies.hash) * 2) as engagement_score
      FROM casts c
      JOIN users u ON c.fid = u.fid
      LEFT JOIN reactions r ON c.hash = r.target_hash
      LEFT JOIN casts replies ON c.hash = replies.parent_hash
      WHERE c.timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY c.hash, c.fid, c.text, c.timestamp, u.username, u.display_name
    )
    SELECT *
    FROM cast_scores
    WHERE engagement_score > 0
    ORDER BY engagement_score DESC, timestamp DESC;
  `,
} as const;

/**
 * Database optimization strategies
 */
export class DatabaseOptimizer {
  constructor(private db: PostgresJsDatabase<any>) {}

  /**
   * Create all advanced indexes
   */
  async createAdvancedIndexes(): Promise<void> {
    console.log("🔧 Creating advanced database indexes...");

    for (const [name, query] of Object.entries(ADVANCED_INDEXES)) {
      try {
        console.log(`Creating index: ${name}`);
        await this.db.execute(sql.raw(query));
        console.log(`✅ Created index: ${name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to create index ${name}:`, error);
      }
    }
  }

  /**
   * Create optimized views
   */
  async createOptimizedViews(): Promise<void> {
    console.log("📊 Creating optimized database views...");

    for (const [name, query] of Object.entries(OPTIMIZED_VIEWS)) {
      try {
        console.log(`Creating view: ${name}`);
        await this.db.execute(sql.raw(query));
        console.log(`✅ Created view: ${name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to create view ${name}:`, error);
      }
    }
  }

  /**
   * Analyze table statistics for query optimization
   */
  async analyzeTableStatistics(): Promise<void> {
    console.log("📈 Analyzing table statistics...");

    const tables = [
      "targets",
      "target_clients",
      "users",
      "casts",
      "reactions",
      "links",
      "verifications",
      "user_data",
      "username_proofs",
      "on_chain_events",
      "sync_state",
    ];

    for (const table of tables) {
      try {
        await this.db.execute(sql.raw(`ANALYZE ${table}`));
        console.log(`✅ Analyzed table: ${table}`);
      } catch (error) {
        console.warn(`⚠️ Failed to analyze table ${table}:`, error);
      }
    }
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    indexUsage: any[];
    tableStats: any[];
    slowQueries: any[];
    cacheHitRatio: number;
  }> {
    console.log("📊 Gathering performance metrics...");

    try {
      // Index usage statistics
      const indexUsage = await this.db.execute(
        sql.raw(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 20;
      `)
      );

      // Table statistics
      const tableStats = await this.db.execute(
        sql.raw(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `)
      );

      // Cache hit ratio
      const cacheHitResult = await this.db.execute(
        sql.raw(`
        SELECT 
          sum(heap_blks_hit) * 100.0 / 
          NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) as cache_hit_ratio
        FROM pg_statio_user_tables;
      `)
      );

      const cacheHitRatio = (cacheHitResult as any)[0]?.cache_hit_ratio || 0;

      // Note: pg_stat_statements would be needed for slow query analysis
      // but it requires the extension to be installed
      const slowQueries: any[] = [];

      return {
        indexUsage: (indexUsage as any) || [],
        tableStats: (tableStats as any) || [],
        slowQueries,
        cacheHitRatio: Number(cacheHitRatio),
      };
    } catch (error) {
      console.warn("⚠️ Failed to gather performance metrics:", error);
      return {
        indexUsage: [],
        tableStats: [],
        slowQueries: [],
        cacheHitRatio: 0,
      };
    }
  }

  /**
   * Optimize table maintenance
   */
  async performMaintenance(): Promise<void> {
    console.log("🧹 Performing database maintenance...");

    const maintenanceTasks = [
      // Update table statistics
      "ANALYZE;",

      // Vacuum dead tuples (non-blocking)
      "VACUUM (ANALYZE);",

      // Reindex heavily used indexes (do this during low traffic)
      // 'REINDEX INDEX CONCURRENTLY casts_fid_timestamp_idx;',
    ];

    for (const task of maintenanceTasks) {
      try {
        console.log(`Running: ${task.substring(0, 50)}...`);
        await this.db.execute(sql.raw(task));
        console.log("✅ Completed maintenance task");
      } catch (error) {
        console.warn("⚠️ Maintenance task failed:", error);
      }
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      const metrics = await this.getPerformanceMetrics();

      // Cache hit ratio recommendations
      if (metrics.cacheHitRatio < 95) {
        recommendations.push(
          `Cache hit ratio is ${metrics.cacheHitRatio.toFixed(
            1
          )}%. Consider increasing shared_buffers.`
        );
      }

      // Index usage recommendations
      const unusedIndexes = metrics.indexUsage.filter(
        (idx) => idx.idx_scan < 10
      );
      if (unusedIndexes.length > 0) {
        recommendations.push(
          `Found ${unusedIndexes.length} potentially unused indexes. Consider dropping them.`
        );
      }

      // Dead tuple recommendations
      const tablesWithDeadTuples = metrics.tableStats.filter(
        (table) => table.dead_tuples > table.live_tuples * 0.1
      );
      if (tablesWithDeadTuples.length > 0) {
        recommendations.push(
          `Tables with high dead tuple ratio: ${tablesWithDeadTuples
            .map((t) => t.tablename)
            .join(", ")}. Consider VACUUM.`
        );
      }

      // Analyze recommendations
      const staleAnalyze = metrics.tableStats.filter(
        (table) =>
          !table.last_analyze ||
          new Date(table.last_analyze).getTime() <
            Date.now() - 7 * 24 * 60 * 60 * 1000
      );
      if (staleAnalyze.length > 0) {
        recommendations.push(
          `Tables with stale statistics: ${staleAnalyze
            .map((t) => t.tablename)
            .join(", ")}. Run ANALYZE.`
        );
      }
    } catch (error) {
      console.warn("Failed to generate recommendations:", error);
      recommendations.push("Unable to analyze database for recommendations.");
    }

    return recommendations;
  }

  /**
   * Generate a comprehensive optimization report
   */
  async generateOptimizationReport(): Promise<string> {
    console.log("📋 Generating optimization report...");

    const metrics = await this.getPerformanceMetrics();
    const recommendations = await this.generateRecommendations();

    let report = "\n🗄️ Database Optimization Report\n";
    report += `${"=".repeat(50)}\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Performance Overview
    report += "📊 Performance Overview:\n";
    report += `${"-".repeat(30)}\n`;
    report += `Cache Hit Ratio: ${metrics.cacheHitRatio.toFixed(1)}%\n`;
    report += `Tables Analyzed: ${metrics.tableStats.length}\n`;
    report += `Indexes Monitored: ${metrics.indexUsage.length}\n\n`;

    // Top Tables by Size
    report += "📈 Top Tables by Live Tuples:\n";
    report += `${"-".repeat(30)}\n`;
    for (const table of metrics.tableStats.slice(0, 5)) {
      report += `${table.tablename}: ${
        table.live_tuples?.toLocaleString() || 0
      } rows\n`;
    }
    report += "\n";

    // Top Indexes by Usage
    report += "🔍 Top Indexes by Scans:\n";
    report += `${"-".repeat(30)}\n`;
    for (const index of metrics.indexUsage.slice(0, 5)) {
      report += `${index.indexname}: ${
        index.idx_scan?.toLocaleString() || 0
      } scans\n`;
    }
    report += "\n";

    // Recommendations
    report += "💡 Optimization Recommendations:\n";
    report += `${"-".repeat(30)}\n`;
    if (recommendations.length === 0) {
      report +=
        "No specific recommendations at this time. Database appears well-optimized.\n";
    } else {
      recommendations.forEach((rec, i) => {
        report += `${i + 1}. ${rec}\n`;
      });
    }

    return report;
  }
}

/**
 * Connection pooling configuration
 */
export const CONNECTION_POOL_CONFIG = {
  // Production settings
  PRODUCTION: {
    max: 20, // Maximum connections
    min: 5, // Minimum connections
    idle_timeout: 20, // Seconds before closing idle connections
    max_lifetime: 60 * 30, // 30 minutes max connection lifetime
    connect_timeout: 10, // Connection timeout in seconds
    prepare: false, // Don't use prepared statements by default
  },

  // Development settings
  DEVELOPMENT: {
    max: 10,
    min: 2,
    idle_timeout: 20,
    max_lifetime: 60 * 10, // 10 minutes
    connect_timeout: 10,
    prepare: false,
  },

  // Test settings
  TEST: {
    max: 5,
    min: 1,
    idle_timeout: 10,
    max_lifetime: 60 * 5, // 5 minutes
    connect_timeout: 5,
    prepare: false,
  },
} as const;

/**
 * Query optimization utilities
 */
export const QueryOptimizer = {
  /**
   * Get optimized feed query for a user
   */
  getFeedQuery(userFid: number, limit = 50, offset = 0) {
    return sql`
      SELECT 
        c.hash,
        c.fid,
        c.text,
        c.timestamp,
        c.embeds,
        c.parent_hash,
        c.parent_fid,
        u.username,
        u.display_name,
        u.pfp_url
      FROM casts c
      INNER JOIN users u ON c.fid = u.fid
      INNER JOIN links l ON c.fid = l.target_fid
      WHERE l.fid = ${userFid}
        AND l.type = 'follow'
        AND c.timestamp > NOW() - INTERVAL '7 days'
      ORDER BY c.timestamp DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  },

  /**
   * Get optimized user engagement query
   */
  getUserEngagementQuery(userFid: number, days = 30) {
    return sql`
      SELECT 
        COUNT(*) FILTER (WHERE r.type = 'like') as likes_received,
        COUNT(*) FILTER (WHERE r.type = 'recast') as recasts_received,
        COUNT(DISTINCT r.fid) as unique_engagers
      FROM casts c
      LEFT JOIN reactions r ON c.hash = r.target_hash
      WHERE c.fid = ${userFid}
        AND c.timestamp > NOW() - INTERVAL '${sql.raw(`${days} days`)}'
    `;
  },

  /**
   * Get optimized trending content query
   */
  getTrendingQuery(hours = 24, limit = 50) {
    return sql`
      SELECT 
        c.hash,
        c.fid,
        c.text,
        c.timestamp,
        u.username,
        u.display_name,
        COUNT(r.hash) FILTER (WHERE r.type = 'like') as likes,
        COUNT(r.hash) FILTER (WHERE r.type = 'recast') as recasts,
        (COUNT(r.hash) FILTER (WHERE r.type = 'like') * 1 +
         COUNT(r.hash) FILTER (WHERE r.type = 'recast') * 3) as engagement_score
      FROM casts c
      INNER JOIN users u ON c.fid = u.fid
      LEFT JOIN reactions r ON c.hash = r.target_hash
      WHERE c.timestamp > NOW() - INTERVAL '${sql.raw(`${hours} hours`)}'
      GROUP BY c.hash, c.fid, c.text, c.timestamp, u.username, u.display_name
      HAVING COUNT(r.hash) > 0
      ORDER BY engagement_score DESC, c.timestamp DESC
      LIMIT ${limit}
    `;
  },
};

/**
 * Performance monitoring utilities
 */
export class DatabaseMonitor {
  constructor(private db: PostgresJsDatabase<any>) {}

  /**
   * Monitor active connections
   */
  async getActiveConnections() {
    const result = await this.db.execute(sql`
      SELECT 
        state,
        COUNT(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
    `);

    return result as any;
  }

  /**
   * Monitor blocking queries
   */
  async getBlockingQueries() {
    const result = await this.db.execute(sql`
      SELECT 
        blocked_locks.pid AS blocked_pid,
        blocked_activity.usename AS blocked_user,
        blocking_locks.pid AS blocking_pid,
        blocking_activity.usename AS blocking_user,
        blocked_activity.query AS blocked_statement,
        blocking_activity.query AS current_statement_in_blocking_process
      FROM pg_catalog.pg_locks blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity 
        ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks blocking_locks 
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_catalog.pg_stat_activity blocking_activity 
        ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted
    `);

    return result as any;
  }

  /**
   * Get table sizes
   */
  async getTableSizes() {
    const result = await this.db.execute(sql`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(tablename::regclass) DESC
    `);

    return result as any;
  }
}
