import SDK from 'azure-devops-extension-sdk';
import { IProjectPageService, CommonServiceIds } from 'azure-devops-extension-api';
import { logger } from '../core/common/logger';

const tagServiceLogger = logger.createChild('TagService');

export interface ProjectTag {
  id: string;
  name: string;
}

interface WorkItemTagDefinition {
  id: string;
  name: string;
  lastUpdated: string;
  url: string;
}

/**
 * Fetches all tags available in the current project.
 * @returns A promise resolving to an array of ProjectTag objects.
 */
export async function getProjectTags(): Promise<ProjectTag[]> {
  try {
    await SDK.ready();
    const projectService = await SDK.getService<IProjectPageService>(
      CommonServiceIds.ProjectPageService,
    );
    const project = await projectService.getProject();

    if (!project) {
      tagServiceLogger.warn('No project context available');
      return [];
    }

    // Get the access token
    const accessToken = await SDK.getAccessToken();
    const host = SDK.getHost();

    if (!host || !host.name) {
      tagServiceLogger.warn('Could not determine organization name');
      return [];
    }

    // Make direct REST call to get tags
    const url = `https://dev.azure.com/${host.name}/${project.name}/_apis/wit/tags?api-version=7.2-preview.1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const tags: WorkItemTagDefinition[] = data.value || [];

    // Convert to ProjectTag array
    return tags
      .map((tag: WorkItemTagDefinition) => ({
        id: tag.id,
        name: tag.name,
      }))
      .sort((a: ProjectTag, b: ProjectTag) => a.name.localeCompare(b.name));
  } catch (error) {
    tagServiceLogger.error('Failed to fetch project tags:', error);
    return [];
  }
}
