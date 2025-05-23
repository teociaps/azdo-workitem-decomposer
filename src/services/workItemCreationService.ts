import SDK from 'azure-devops-extension-sdk';
import { getClient } from 'azure-devops-extension-api';
import { WorkItemTrackingRestClient } from 'azure-devops-extension-api/WorkItemTracking';
import { JsonPatchOperation, Operation } from 'azure-devops-extension-api/WebApi/WebApi';
import { WorkItemNode } from '../core/models/workItemHierarchy';
import settingsService from './settingsService';

/**
 * Recursively creates work items based on the provided hierarchy.
 * @param nodes The current level of nodes in the hierarchy to create.
 * @param currentParentId The Azure DevOps ID of the parent work item for this level.
 * @param client The WorkItemTrackingRestClient instance.
 * @param project The project name.
 * @param errors An array to collect error messages during creation.
 */
const createHierarchyRecursive = async (
  nodes: WorkItemNode[],
  currentParentId: number,
  client: WorkItemTrackingRestClient,
  project: string,
  errors: string[],
): Promise<void> => {
  const currentSettings = await settingsService.getSettings();

  for (const node of nodes) {
    if (!node.type || !node.title.trim()) {
      console.warn(`Skipping node due to missing type or title: ${JSON.stringify(node)}`);
      continue;
    }

    const patchDocument: JsonPatchOperation[] = [
      {
        op: Operation.Add,
        path: '/fields/System.Title',
        value: node.title,
      } as JsonPatchOperation,
    ];

    // Conditionally add comment based on settings
    if (currentSettings.addCommentsToWorkItems && currentSettings.commentText) {
      const commentText = currentSettings.commentText;
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.History',
        value: commentText,
      } as JsonPatchOperation);
    }

    // Add parent link if applicable
    if (currentParentId > 0) {
      patchDocument.push({
        op: Operation.Add,
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `https://dev.azure.com/${SDK.getHost().name}/${encodeURIComponent(
            project,
          )}/_apis/wit/workItems/${currentParentId}`,
        },
      } as JsonPatchOperation);
    }

    try {
      console.log(
        `Attempting to create '${node.title}' (${node.type}) under parent ${currentParentId}`,
      );
      const createdWorkItem = await client.createWorkItem(patchDocument, project, node.type);
      console.log(`Successfully created WI ID: ${createdWorkItem.id} for '${node.title}'`);

      if (createdWorkItem.id && node.children.length > 0) {
        await createHierarchyRecursive(node.children, createdWorkItem.id, client, project, errors);
      }
    } catch (err: any) {
      const errorMessage = `Failed to create '${node.title}' (${
        node.type
      }) under parent ${currentParentId}: ${err.message || err}`;
      console.error(errorMessage, err);
      errors.push(errorMessage);
    }
  }
};

/**
 * Initiates the process of creating a hierarchy of work items.
 * @param hierarchy The root nodes of the hierarchy to create.
 * @param parentWorkItemId The ID of the ultimate parent work item.
 * @param projectName The name of the project.
 * @returns A promise resolving to an array of error messages (empty if successful).
 */
export const createWorkItemHierarchy = async (
  hierarchy: WorkItemNode[],
  parentWorkItemId: number,
  projectName: string,
): Promise<string[]> => {
  const errors: string[] = [];
  if (!projectName) {
    errors.push('Project name is missing. Cannot create work items.');
    return errors;
  }
  if (parentWorkItemId <= 0) {
    errors.push('Parent Work Item ID is invalid. Cannot create work items.');
    return errors;
  }
  if (hierarchy.length === 0) {
    errors.push('No items in the hierarchy to create.');
    return errors;
  }

  const client: WorkItemTrackingRestClient = getClient(WorkItemTrackingRestClient);

  console.log(
    `Starting creation process for hierarchy under parent WI ID: ${parentWorkItemId} in project '${projectName}'`,
  );
  try {
    await createHierarchyRecursive(hierarchy, parentWorkItemId, client, projectName, errors);
  } catch (err: any) {
    const errorMessage = `An unexpected error occurred during the hierarchy creation process: ${
      err.message || err
    }`;
    console.error(errorMessage, err);
    errors.push(errorMessage);
  }
  console.log('Creation process finished. Errors encountered:', errors.length);

  return errors;
};
