import SDK from 'azure-devops-extension-sdk';
import { getClient } from 'azure-devops-extension-api';
import { WorkItemTrackingRestClient } from 'azure-devops-extension-api/WorkItemTracking';
import { JsonPatchOperation, Operation } from 'azure-devops-extension-api/WebApi/WebApi';
import { WorkItemNode } from '../core/models/workItemHierarchy';
import settingsService, { getWitSettingsForAreaPath } from './settingsService';
import { ITagSettings, TagInheritance } from '../core/models/tagSettings';
import { IAssignmentSettings, AssignmentBehavior } from '../core/models/assignmentSettings';
import { UserService } from './userService';
import { logger } from '../core/common/logger';

const creationLogger = logger.createChild('Creation');

/**
 * Calculates the tags that should be applied to a work item based on settings and inheritance.
 * @param node The work item node being created
 * @param parentWorkItem The parent work item (if any)
 * @param tagSettings The tag settings configuration
 * @param ancestorTags Tags accumulated from all ancestors in the hierarchy
 * @returns Array of tag names to apply
 */
const calculateTagsForWorkItem = (
  node: WorkItemNode,
  parentWorkItem: { fields: { [key: string]: string } } | null,
  tagSettings: ITagSettings,
  ancestorTags: Set<string> = new Set(),
): string[] => {
  const witSettings = tagSettings[node.type];
  creationLogger.debug(`WIT settings for ${node.type}:`, witSettings);

  if (!witSettings) {
    creationLogger.debug(`No WIT settings found for type: ${node.type}`);
    return [];
  }

  const tags = new Set<string>(witSettings.tags || []);
  creationLogger.debug(`Initial tags for ${node.type}:`, Array.from(tags));

  if (parentWorkItem && witSettings.inheritance !== TagInheritance.NONE) {
    const parentTags = (parentWorkItem.fields['System.Tags'] || '')
      .split(';')
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0);

    creationLogger.debug(
      `Parent tags: ${parentTags.join(', ')}, inheritance: ${witSettings.inheritance}`,
    );

    if (witSettings.inheritance === TagInheritance.PARENT) {
      parentTags.forEach((tag: string) => tags.add(tag));
    } else if (witSettings.inheritance === TagInheritance.ANCESTORS) {
      // Add all ancestor tags (accumulated from the hierarchy chain)
      ancestorTags.forEach((tag: string) => tags.add(tag));
      // Also add the direct parent tags to the ancestor collection
      parentTags.forEach((tag: string) => tags.add(tag));
    }
  }

  const finalTags = Array.from(tags);
  creationLogger.debug(`Final tags for ${node.type}: ${finalTags.join(', ')}`);
  return finalTags;
};

/**
 * Calculates the assignee that should be applied to a work item based on assignment settings.
 * @param node The work item node being created
 * @param assignmentSettings The assignment settings configuration
 * @param rootParentWorkItem The root parent work item being decomposed (for assignment inheritance)
 * @returns The assignee display name or unique name to apply, or null for no assignment
 */
const calculateAssigneeForWorkItem = async (
  node: WorkItemNode,
  assignmentSettings: IAssignmentSettings,
  rootParentWorkItem: { fields: { [key: string]: string } } | null = null,
): Promise<string | null> => {
  const witSettings = assignmentSettings[node.type];
  creationLogger.debug(`Assignment settings for ${node.type}:`, witSettings);

  if (!witSettings || witSettings.behavior === AssignmentBehavior.NONE) {
    creationLogger.debug(`No assignment settings or NONE behavior for type: ${node.type}`);
    return null;
  }

  switch (witSettings.behavior) {
    case AssignmentBehavior.DECOMPOSING_ITEM:
      if (rootParentWorkItem) {
        const rootParentAssignee = rootParentWorkItem.fields['System.AssignedTo'];
        creationLogger.debug(`Root parent work item assignee found: ${rootParentAssignee}`);
        return rootParentAssignee || null;
      } else {
        creationLogger.debug('No root parent work item available for assignment inheritance');
        return null;
      }

    case AssignmentBehavior.CREATOR:
      try {
        const currentUser = await UserService.getCurrentUser();
        if (currentUser) {
          creationLogger.debug(
            `Current user found: ${currentUser.displayName} (${currentUser.uniqueName})`,
          );
          // Use the uniqueName for assignment as it's what Azure DevOps expects
          return currentUser.uniqueName || currentUser.email;
        } else {
          creationLogger.warn('Could not get current user for assignment');
          return null;
        }
      } catch (error) {
        creationLogger.error('Error getting current user for assignment:', error);
        return null;
      }

    default:
      creationLogger.debug(`Unknown assignment behavior: ${witSettings.behavior}`);
      return null;
  }
};

/**
 * Recursively creates work items based on the provided hierarchy.
 * @param nodes The current level of nodes in the hierarchy to create.
 * @param currentParentId The Azure DevOps ID of the parent work item for this level.
 * @param client The WorkItemTrackingRestClient instance.
 * @param project The project name.
 * @param errors An array to collect error messages during creation.
 * @param parentWorkItem The parent work item object for tag inheritance.
 * @param ancestorTags Tags accumulated from all ancestors in the hierarchy.
 * @param rootParentWorkItem The root parent work item being decomposed (for assignment inheritance).
 * @param parentAreaPath The area path from the parent work item to use for settings resolution.
 */
const createHierarchyRecursive = async (
  nodes: WorkItemNode[],
  currentParentId: number,
  client: WorkItemTrackingRestClient,
  project: string,
  errors: string[],
  parentWorkItem: { fields: { [key: string]: string } } | null = null,
  ancestorTags: Set<string> = new Set(),
  rootParentWorkItem: { fields: { [key: string]: string } } | null = null,
  parentAreaPath: string | null = null,
): Promise<void> => {
  const currentSettings = await settingsService.getSettings();

  for (const node of nodes) {
    if (!node.type || !node.title.trim()) {
      creationLogger.warn(`Skipping node due to missing type or title: ${JSON.stringify(node)}`);
      continue;
    }

    // Determine the area path for this work item (use node's areaPath or inherit from parent)
    const workItemAreaPath = node.areaPath || parentAreaPath;

    // Get the appropriate WIT settings based on the area path
    const witSettingsForArea = getWitSettingsForAreaPath(currentSettings, workItemAreaPath);
    const tagSettings: ITagSettings = witSettingsForArea.tags || {};
    const assignmentSettings: IAssignmentSettings = witSettingsForArea.assignments || {};

    const patchDocument: JsonPatchOperation[] = [
      {
        op: Operation.Add,
        path: '/fields/System.Title',
        value: node.title,
      } as JsonPatchOperation,
    ];

    // Calculate and apply tags
    const tagsToApply = calculateTagsForWorkItem(node, parentWorkItem, tagSettings, ancestorTags);
    creationLogger.debug(
      `Tags calculated for ${node.type} '${node.title}' (area: ${workItemAreaPath || 'default'}): ${tagsToApply.join(', ')}`,
    );

    if (tagsToApply.length > 0) {
      const tagValue = tagsToApply.join(';');
      creationLogger.debug(`Adding tags to work item: ${tagValue}`);
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.Tags',
        value: tagValue,
      } as JsonPatchOperation);
    }

    // Calculate and apply assignment
    const assigneeToApply = await calculateAssigneeForWorkItem(
      node,
      assignmentSettings,
      rootParentWorkItem,
    );
    creationLogger.debug(
      `Assignee calculated for ${node.type} '${node.title}' (area: ${workItemAreaPath || 'default'}): ${assigneeToApply || 'none'}`,
    );

    if (assigneeToApply) {
      creationLogger.debug(`Adding assignee to work item: ${assigneeToApply}`);
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.AssignedTo',
        value: assigneeToApply,
      } as JsonPatchOperation);
    }

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

    // Add Area Path and Iteration Path if present
    if (node.areaPath) {
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.AreaPath',
        value: node.areaPath,
      } as JsonPatchOperation);
    }
    if (node.iterationPath) {
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.IterationPath',
        value: node.iterationPath,
      } as JsonPatchOperation);
    }

    try {
      creationLogger.debug(
        `Attempting to create '${node.title}' (${node.type}) under parent ${currentParentId}`,
      );
      const createdWorkItem = await client.createWorkItem(patchDocument, project, node.type);
      creationLogger.info(`Successfully created WI ID: ${createdWorkItem.id} for '${node.title}'`);

      if (createdWorkItem.id && node.children.length > 0) {
        // Build the new ancestor tags set for the next level
        const newAncestorTags = new Set(ancestorTags);

        // Add current work item's tags to the ancestor collection for the next level
        if (tagsToApply.length > 0) {
          tagsToApply.forEach((tag) => newAncestorTags.add(tag));
        }

        // Pass the area path down to children (they will use their own areaPath if specified, or inherit this one)
        const childAreaPath = workItemAreaPath;

        await createHierarchyRecursive(
          node.children,
          createdWorkItem.id,
          client,
          project,
          errors,
          createdWorkItem,
          newAncestorTags,
          rootParentWorkItem,
          childAreaPath,
        );
      }
    } catch (err: unknown) {
      const errorMessage = `Failed to create '${node.title}' (${
        node.type
      }) under parent ${currentParentId}: ${(err as Error).message || err}`;
      creationLogger.error(errorMessage, err);
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

  creationLogger.info(
    `Starting creation process for hierarchy under parent WI ID: ${parentWorkItemId} in project '${projectName}'`,
  );
  try {
    // Fetch the root parent work item being decomposed for assignment inheritance and area path
    let rootParentWorkItem: { fields: { [key: string]: string } } | null = null;
    let parentAreaPath: string | null = null;

    try {
      const parentWorkItem = await client.getWorkItem(parentWorkItemId, projectName, [
        'System.AreaPath',
      ]);
      rootParentWorkItem = parentWorkItem;
      parentAreaPath = parentWorkItem.fields?.['System.AreaPath'] || null;
      creationLogger.debug(
        'Root parent work item loaded for assignment inheritance and area path:',
        parentWorkItem.id,
        'Area path:',
        parentAreaPath,
      );
    } catch (error) {
      creationLogger.warn(
        'Could not load root parent work item for assignment inheritance and area path:',
        error,
      );
      // Continue without assignment inheritance and area path - will use defaults
    }

    await createHierarchyRecursive(
      hierarchy,
      parentWorkItemId,
      client,
      projectName,
      errors,
      null,
      new Set(),
      rootParentWorkItem,
      parentAreaPath,
    );
  } catch (err: unknown) {
    const errorMessage = `An unexpected error occurred during the hierarchy creation process: ${
      (err as Error).message || err
    }`;
    creationLogger.error(errorMessage, err);
    errors.push(errorMessage);
  }
  creationLogger.info('Creation process finished. Errors encountered:', errors.length);

  return errors;
};
