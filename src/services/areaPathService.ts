import SDK from 'azure-devops-extension-sdk';
import { getClient } from 'azure-devops-extension-api';
import {
  WorkItemTrackingRestClient,
  TreeStructureGroup,
  WorkItemClassificationNode,
} from 'azure-devops-extension-api/WorkItemTracking';
import { logger } from '../core/common/logger';

const areaPathLogger = logger.createChild('AreaPath');

export interface AreaPathNode {
  id: number;
  path: string;
  name: string;
  hasChildren: boolean;
}

/**
 * Fetches all area paths for the current project
 * @returns A promise resolving to an array of AreaPathNode objects
 */
export const getProjectAreaPaths = async (): Promise<AreaPathNode[]> => {
  try {
    await SDK.init();
    await SDK.ready();

    const webContext = SDK.getPageContext().webContext;
    const currentProject = webContext.project;

    if (!currentProject) {
      throw new Error('Could not retrieve current project information');
    }

    const client: WorkItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
    const areaPathTree = await client.getClassificationNode(
      currentProject.name,
      TreeStructureGroup.Areas,
      undefined,
      10, // depth to get reasonable amount of nested areas
    );

    const areaPaths: AreaPathNode[] = [];

    const processNode = (node: WorkItemClassificationNode, parentPath = '') => {
      const currentPath = parentPath ? `${parentPath}\\${node.name}` : node.name;

      areaPaths.push({
        id: node.id || 0,
        path: currentPath,
        name: node.name || '',
        hasChildren: node.children ? node.children.length > 0 : false,
      });

      if (node.children) {
        node.children.forEach((child: WorkItemClassificationNode) =>
          processNode(child, currentPath),
        );
      }
    };

    processNode(areaPathTree);

    areaPathLogger.debug(
      `Loaded ${areaPaths.length} area paths for project ${currentProject.name}`,
    );
    return areaPaths;
  } catch (error) {
    areaPathLogger.error('Failed to load area paths:', error);
    throw error;
  }
};

/**
 * Gets the area path for a specific work item
 * @param workItemId The ID of the work item
 * @param projectName The project name
 * @returns A promise resolving to the area path string
 */
export const getWorkItemAreaPath = async (
  workItemId: number,
  projectName: string,
): Promise<string | null> => {
  try {
    const client: WorkItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
    const workItem = await client.getWorkItem(workItemId, projectName, ['System.AreaPath']);

    return workItem.fields?.['System.AreaPath'] || null;
  } catch (error) {
    areaPathLogger.error(`Failed to get area path for work item ${workItemId}:`, error);
    return null;
  }
};

/**
 * Finds the best matching area path settings for a given work item area path
 * @param workItemAreaPath The area path of the work item
 * @param availableAreaPaths Array of area paths that have specific settings
 * @returns The best matching area path or null if no match
 */
export const findBestMatchingAreaPath = (
  workItemAreaPath: string,
  availableAreaPaths: string[],
): string | null => {
  if (!workItemAreaPath || availableAreaPaths.length === 0) {
    return null;
  }

  // Exact match first
  if (availableAreaPaths.includes(workItemAreaPath)) {
    return workItemAreaPath;
  }

  // Find the longest parent path that matches
  let bestMatch: string | null = null;
  let bestMatchLength = 0;

  for (const areaPath of availableAreaPaths) {
    if (workItemAreaPath.startsWith(`${areaPath}\\`)) {
      if (areaPath.length > bestMatchLength) {
        bestMatch = areaPath;
        bestMatchLength = areaPath.length;
      }
    }
  }

  return bestMatch;
};
