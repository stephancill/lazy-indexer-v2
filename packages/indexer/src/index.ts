import { config, HubClient } from '@farcaster-indexer/shared';
import { 
  createBackfillWorker, 
  createRealtimeWorker, 
  createProcessEventWorker,
  initializeTargetSets,
  scheduleRealtimeSync,
  shutdown
} from './queue.js';
import { createBackfillProcessor } from './jobs/backfill.js';
import { createRealtimeProcessor } from './jobs/realtime.js';
import { createProcessorWorker } from './jobs/processor.js';
import { monitoringApp } from './monitoring.js';

class FarcasterIndexer {
  private hubClient: HubClient;
  private workers: any[] = [];
  private monitoringServer: any;

  constructor() {
    this.hubClient = new HubClient(config.hubs);
  }

  async start() {
    try {
      console.log('Starting Farcaster Indexer...');
      
      // Initialize target sets in Redis
      await initializeTargetSets();
      
      // Start workers
      await this.startWorkers();
      
      // Start monitoring server
      await this.startMonitoringServer();
      
      // Schedule recurring realtime sync
      await scheduleRealtimeSync();
      
      console.log('Farcaster Indexer started successfully!');
      console.log('Monitoring dashboard available at: http://localhost:3001/admin/queues');
      
    } catch (error) {
      console.error('Failed to start Farcaster Indexer:', error);
      process.exit(1);
    }
  }

  private async startWorkers() {
    console.log('Starting worker processes...');
    
    // Create backfill worker
    const backfillWorker = createBackfillWorker(
      createBackfillProcessor(this.hubClient)
    );
    
    // Create realtime worker
    const realtimeWorker = createRealtimeWorker(
      createRealtimeProcessor(this.hubClient)
    );
    
    // Create event processor worker
    const processEventWorker = createProcessEventWorker(
      createProcessorWorker()
    );
    
    this.workers = [backfillWorker, realtimeWorker, processEventWorker];
    
    // Set up error handling for workers
    this.workers.forEach((worker, index) => {
      worker.on('error', (error: Error) => {
        console.error(`Worker ${index} error:`, error);
      });
      
      worker.on('failed', (job: any, error: Error) => {
        console.error(`Job ${job.id} failed:`, error);
      });
      
      worker.on('completed', (job: any) => {
        console.log(`Job ${job.id} completed successfully`);
      });
    });
    
    console.log(`Started ${this.workers.length} workers`);
  }

  private async startMonitoringServer() {
    const port = process.env.MONITORING_PORT || 3001;
    
    // Note: We'll need to use a proper HTTP server here
    // For now, this is a placeholder - the monitoring app would be served by the API server
    console.log(`Monitoring server configured for port ${port}`);
    console.log('Note: Monitoring will be served by the API server');
  }

  async stop() {
    console.log('Stopping Farcaster Indexer...');
    
    // Stop workers
    if (this.workers.length > 0) {
      await Promise.all(this.workers.map(worker => worker.close()));
      console.log('All workers stopped');
    }
    
    // Stop monitoring server
    if (this.monitoringServer) {
      this.monitoringServer.close();
      console.log('Monitoring server stopped');
    }
    
    // Shutdown queue system
    await shutdown();
    
    console.log('Farcaster Indexer stopped successfully');
  }
}

// Create and start the indexer
const indexer = new FarcasterIndexer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await indexer.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await indexer.stop();
  process.exit(0);
});

// Export for use in other modules
export { indexer };

// Start the indexer if this file is run directly
if (import.meta.main) {
  indexer.start().catch((error) => {
    console.error('Failed to start indexer:', error);
    process.exit(1);
  });
}