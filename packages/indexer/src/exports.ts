// Export public API for other packages
export {
  scheduleBackfillJob,
  getAllQueueStats,
  getQueueStats,
  addTargetToSet,
  removeTargetFromSet,
  addClientTargetToSet,
  removeClientTargetFromSet,
  pauseQueue,
  resumeQueue,
  clearQueue,
  initializeTargetSets,
  shutdown
} from './queue.js';

export { indexer } from './index.js';