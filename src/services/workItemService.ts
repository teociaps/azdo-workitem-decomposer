import SDK from 'azure-devops-extension-sdk';
import { getClient } from 'azure-devops-extension-api';
import { WorkItemTrackingRestClient } from 'azure-devops-extension-api/WorkItemTracking';
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking/WorkItemTracking';
import {
  JsonPatchDocument,
  JsonPatchOperation,
  Operation,
} from 'azure-devops-extension-api/WebApi/WebApi';
import { WorkItemNode } from '../models/workItemHierarchy';

// TODO: add get work item types API call to get the work item types for the project

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

/**
 * Recursively creates work items based on the provided hierarchy.
 * @param nodes The current level of nodes in the hierarchy to create.
 * @param currentParentId The Azure DevOps ID of the parent work item for this level.
 * @param client The WorkItemTrackingRestClient instance.
 * @param project The project name.
 * @param hostUri The base URI of the Azure DevOps host.
 * @param errors An array to collect error messages during creation.
 */
const createHierarchyRecursive = async (
  nodes: WorkItemNode[],
  currentParentId: number,
  client: WorkItemTrackingRestClient,
  project: string,
  errors: string[],
): Promise<void> => {
  for (const node of nodes) {
    if (!node.title.trim()) continue;

    const patchDocument: JsonPatchDocument = [
      {
        op: Operation.Add,
        path: '/fields/System.Title',
        value: node.title,
      } as any,
      {
        op: Operation.Add,
        path: '/fields/System.WorkItemType',
        value: node.type,
      } as any,
      {
        op: Operation.Add,
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse', // Parent link
          // Construct URL carefully. Ensure hostUri ends with / and project name is encoded if needed.
          url: `https://dev.azure.com/${SDK.getHost()}/${encodeURIComponent(project)}/_apis/wit/workItems/${currentParentId}`,
          attributes: {
            comment: 'Created via Decompose Extension',
          },
        },
      } as any,
    ];

    try {
      console.log(`Creating ${node.type}: ${node.title} under ${currentParentId}`);
      const createdWorkItem = await client.createWorkItem(patchDocument, project, node.type);
      console.log(`Created WI ID: ${createdWorkItem.id}`);

      if (createdWorkItem.id && node.children.length > 0) {
        // Recursively create children under the newly created item
        await createHierarchyRecursive(
          node.children,
          createdWorkItem.id,
          client,
          project,
          errors,
        );
      }
    } catch (err: any) {
      const errorMessage = `Failed to create ${node.type} '${node.title}': ${err.message}`;
      console.error(errorMessage, err);
      errors.push(errorMessage);
      // Continue creating siblings even if one fails
    }
  }
};

/**
 * Initiates the process of creating a hierarchy of work items.
 * @param hierarchy The root nodes of the hierarchy to create.
 * @param parentWorkItemId The ID of the ultimate parent work item.
 * @param projectName The name of the project.
 * @param hostUri The base URI of the Azure DevOps host.
 * @returns A promise resolving to an array of error messages (empty if successful).
 */
export const createWorkItemHierarchy = async (
  hierarchy: WorkItemNode[],
  parentWorkItemId: number,
  projectName: string,
): Promise<string[]> => {
  const errors: string[] = [];
  const client: WorkItemTrackingRestClient = getClient(WorkItemTrackingRestClient);

  console.log('Starting creation process for hierarchy under:', parentWorkItemId);
  await createHierarchyRecursive(hierarchy, parentWorkItemId, client, projectName, errors);
  console.log('Creation process finished.');

  return errors;
};
