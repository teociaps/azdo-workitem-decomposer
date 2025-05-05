import { getClient } from 'azure-devops-extension-api';
import { WorkItemTrackingRestClient } from 'azure-devops-extension-api/WorkItemTracking';
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking/WorkItemTracking';

/**
 * Fetches details for a specific work item.
 * @param workItemId The ID of the work item to fetch.
 * @param projectName The name of the project.
 * @returns A promise resolving to the WorkItem object.
 */
export const getParentWorkItemDetails = async (
  workItemId: number,
  projectName: string,
): Promise<WorkItem> => {
  const client: WorkItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
  return client.getWorkItem(workItemId, projectName, undefined, undefined, undefined);
};
