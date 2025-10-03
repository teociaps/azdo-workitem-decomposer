import { WorkItemNode } from '../core/models/workItemHierarchy';
import { logger } from '../core/common/logger';

const batchLogger = logger.createChild('BatchCreation');

/**
 * Calculates the total number of work items in a hierarchy (including all nested children).
 * @param hierarchy The hierarchy of work items
 * @returns Total count of all work items in the hierarchy
 */
export const calculateTotalWorkItems = (hierarchy: WorkItemNode[]): number => {
  let total = 0;
  const countNode = (node: WorkItemNode): number => {
    let count = 1;
    node.children.forEach((child) => {
      count += countNode(child);
    });
    return count;
  };
  hierarchy.forEach((rootNode) => {
    total += countNode(rootNode);
  });
  return total;
};

/**
 * Determines optimal batch configuration based on the total number of work items to create.
 * @param totalWorkItems The total number of work items in the hierarchy
 * @returns Object containing optimal batchSize and maxConcurrentBatches
 */
export const calculateOptimalBatchConfig = (
  totalWorkItems: number,
): { batchSize: number; maxConcurrentBatches: number; childConcurrency: number } => {
  if (totalWorkItems <= 20) {
    return { batchSize: totalWorkItems, maxConcurrentBatches: 1, childConcurrency: 1 };
  } else if (totalWorkItems <= 100) {
    return { batchSize: 5, maxConcurrentBatches: 3, childConcurrency: 3 };
  } else if (totalWorkItems <= 500) {
    return { batchSize: 10, maxConcurrentBatches: 5, childConcurrency: 5 };
  } else {
    return { batchSize: 20, maxConcurrentBatches: 8, childConcurrency: 8 };
  }
};

/**
 * Creates batches from the hierarchy based on root-level nodes and their children.
 * @param hierarchy The hierarchy of work items to batch
 * @param batchSize The maximum number of root-level items per batch
 * @returns Array of batches, each containing root nodes and their children
 */
export const createBatches = (hierarchy: WorkItemNode[], batchSize: number): WorkItemNode[][] => {
  const batches: WorkItemNode[][] = [];
  for (let i = 0; i < hierarchy.length; i += batchSize) {
    const batch = hierarchy.slice(i, i + batchSize);
    batches.push(batch);
  }
  batchLogger.debug(`Created ${batches.length} batches from ${hierarchy.length} root items`);
  return batches;
};

/**
 * Processes batches concurrently with a limit on concurrent executions.
 * @param batches Array of batches to process
 * @param maxConcurrent Maximum number of concurrent batch executions
 * @param processBatch Function to process a single batch
 * @returns Array of results from all batch executions
 */
export const processBatchesConcurrently = async <T>(
  batches: WorkItemNode[][],
  maxConcurrent: number,
  processBatch: (_batch: WorkItemNode[], _batchIndex: number) => Promise<T>,
): Promise<T[]> => {
  const results: T[] = new Array(batches.length);
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const chunk = batches.slice(i, i + maxConcurrent);
    const chunkPromises = chunk.map((batch, chunkIndex) => processBatch(batch, i + chunkIndex));
    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach((result, chunkIndex) => {
      results[i + chunkIndex] = result;
    });
  }
  return results;
};

/**
 * Simple helper to run async tasks with a concurrency limit.
 * tasks: array of functions returning Promise<T>
 */
export const runTasksWithLimit = async <T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> => {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  const active: Promise<void>[] = [];

  const runNext = async (): Promise<void> => {
    const current = nextIndex++;
    if (current >= tasks.length) {
      return;
    }
    try {
      const res = await tasks[current]();
      results[current] = res;
    } finally {
      await runNext();
    }
  };

  const starters = Math.min(limit, tasks.length);
  for (let i = 0; i < starters; i++) {
    active.push(runNext());
  }

  await Promise.all(active);
  return results;
};
