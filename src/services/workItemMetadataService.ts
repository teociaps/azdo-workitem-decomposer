import SDK from 'azure-devops-extension-sdk';
import { getClient } from 'azure-devops-extension-api';
import {
  WorkItemTrackingRestClient,
  WorkItemType,
  WorkItemTypeCategory,
  WorkItemTypeReference,
} from 'azure-devops-extension-api/WorkItemTracking';
import {
  WorkRestClient,
  BacklogConfiguration,
  BugsBehavior,
} from 'azure-devops-extension-api/Work';
import { TeamContext } from 'azure-devops-extension-api/Core/Core';
import { logger } from '../core/common/logger';

const metadataLogger = logger.createChild('Metadata');

/**
 * Fetches the available work item types for a specific project.
 * @param projectName The name of the project.
 * @returns A promise resolving to an array of WorkItemType objects.
 */
export const getWorkItemTypes = async (projectName: string): Promise<WorkItemType[]> => {
  const client: WorkItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
  return client.getWorkItemTypes(projectName);
};

/**
 * Fetches the work item type categories for a specific project.
 * These categories (e.g., Epic, Feature, Requirement) often define the hierarchy.
 * @param projectName The name of the project.
 * @returns A promise resolving to an array of WorkItemTypeCategory objects.
 */
export const getWorkItemTypeCategories = async (
  projectName: string,
): Promise<WorkItemTypeCategory[]> => {
  const client: WorkItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
  return client.getWorkItemTypeCategories(projectName);
};

/**
 * Fetches the work item types belonging to a specific category.
 * @param projectName The name of the project.
 * @param categoryRefName The reference name of the category (e.g., "Microsoft.TaskCategory").
 * @returns A promise resolving to an array of work item type names in that category.
 */
const getTypesInCategory = async (
  projectName: string,
  categoryRefName: string,
): Promise<string[]> => {
  try {
    const witClient: WorkItemTrackingRestClient = getClient(WorkItemTrackingRestClient);
    const category = await witClient.getWorkItemTypeCategory(projectName, categoryRefName);
    if (category && category.workItemTypes) {
      return category.workItemTypes.map((wit) => wit.name);
    }
    metadataLogger.warn(
      `Could not reliably get all types for category ${categoryRefName} directly. Relying on BacklogConfiguration.`,
    );
    return [];
  } catch (error) {
    metadataLogger.error(`Failed to get types for category ${categoryRefName}:`, error);
    return [];
  }
};

/**
 * Determines allowed child work item types based on the project's backlog configuration.
 * Considers portfolio, requirement, and task backlogs, and the configured bug behavior.
 *
 * @returns {Promise<Map<string, string[]>>} A promise resolving to a map where keys are parent
 * work item type names and values are arrays of allowed child type names. Returns an empty map on error.
 */
export const getWorkItemHierarchyRules = async (): Promise<Map<string, string[]>> => {
  const rules = new Map<string, string[]>();
  try {
    const workClient: WorkRestClient = getClient(WorkRestClient);

    const webContext = SDK.getPageContext().webContext;
    const currentProject = webContext.project;
    const currentTeam = webContext.team;
    if (!currentProject || !webContext) {
      metadataLogger.error('Could not retrieve current project information via SDK.', {
        currentProject,
        webContext,
      });
      // Fallback or error handling - using the passed projectName might be a fallback
      // For now, let's return empty rules if context is unavailable
      return rules;
    }

    const teamContext: TeamContext = {
      project: currentProject.name,
      projectId: currentProject.id,
      team: currentTeam?.name ?? '',
      teamId: currentTeam?.id ?? '',
    };

    const backlogConfig: BacklogConfiguration =
      await workClient.getBacklogConfigurations(teamContext);

    if (
      !backlogConfig ||
      !backlogConfig.portfolioBacklogs ||
      !backlogConfig.requirementBacklog ||
      !backlogConfig.taskBacklog
    ) {
      metadataLogger.error('Failed to retrieve complete backlog configuration.');
      return rules;
    }

    const sortedPortfolioBacklogs = [...backlogConfig.portfolioBacklogs].sort((a, b) => {
      const rankA = typeof a.rank === 'number' ? a.rank : Infinity;
      const rankB = typeof b.rank === 'number' ? b.rank : Infinity;
      return rankB - rankA; // Sort by rank in descending order: higher rank means a higher level in the hierarchy
    });

    const allBacklogs = [...sortedPortfolioBacklogs, backlogConfig.requirementBacklog];
    const taskBacklog = backlogConfig.taskBacklog;
    const taskTypes: string[] = taskBacklog.workItemTypes.map(
      (wit: WorkItemTypeReference) => wit.name,
    );

    let bugTypes: string[] = [];
    const bugCategoryRefName = 'Microsoft.BugCategory'; // Standard reference name for bugs

    // Check how bugs are configured to behave in the backlog
    if (backlogConfig.bugsBehavior !== BugsBehavior.Off) {
      // Attempt to get bug types from the category first
      const fetchedBugTypes = await getTypesInCategory(currentProject.name, bugCategoryRefName);
      if (fetchedBugTypes.length > 0) {
        bugTypes = fetchedBugTypes;
      } else {
        // Fallback or alternative logic if category fetch fails or is empty
        // Sometimes the backlog config might list them directly under a specific level        // This part might need adjustment based on specific process template details
        metadataLogger.warn(
          `Could not determine Bug work item types from category '${bugCategoryRefName}'. Check project process configuration.`,
        );
        // As a potential fallback, check if they are listed under requirement or task backlog explicitly
        if (
          backlogConfig.bugsBehavior === BugsBehavior.AsRequirements &&
          backlogConfig.requirementBacklog.workItemTypes.some((wit) =>
            wit.name.toLowerCase().includes('bug'),
          ) // Heuristic
        ) {
          bugTypes = backlogConfig.requirementBacklog.workItemTypes
            .filter((wit) => wit.name.toLowerCase().includes('bug'))
            .map((wit) => wit.name);
        } else if (
          backlogConfig.bugsBehavior === BugsBehavior.AsTasks &&
          backlogConfig.taskBacklog.workItemTypes.some((wit) =>
            wit.name.toLowerCase().includes('bug'),
          ) // Heuristic
        ) {
          bugTypes = backlogConfig.taskBacklog.workItemTypes
            .filter((wit) => wit.name.toLowerCase().includes('bug'))
            .map((wit) => wit.name);
        }
      }
    }

    const bugsAppearOnRequirements = backlogConfig.bugsBehavior === BugsBehavior.AsRequirements;
    const bugsAppearOnTasks = backlogConfig.bugsBehavior === BugsBehavior.AsTasks;

    for (let i = 0; i < allBacklogs.length; i++) {
      const currentLevel = allBacklogs[i];
      const currentLevelTypes = currentLevel.workItemTypes.map(
        (wit: WorkItemTypeReference) => wit.name,
      );

      const allowedChildTypes: string[] = [];

      if (i + 1 < allBacklogs.length) {
        const nextLowerLevel = allBacklogs[i + 1];
        allowedChildTypes.push(
          ...nextLowerLevel.workItemTypes.map((wit: WorkItemTypeReference) => wit.name),
        );
      } else {
        allowedChildTypes.push(...taskTypes);
      }

      // Add bugs as children if they appear with requirements AND the current level is NOT the requirement level
      // AND the next level IS the requirement level (meaning current level is portfolio above requirements)
      if (
        bugsAppearOnRequirements &&
        currentLevel.id !== backlogConfig.requirementBacklog.id // Check if current level is NOT the requirement backlog
      ) {
        // This logic seems complex. A simpler approach might be needed.
        // If the intent is "add bugs to children of portfolio items if bugs are like requirements",
        // we need to ensure the *next* level is the requirement level.
        if (
          i + 1 < allBacklogs.length &&
          allBacklogs[i + 1].id === backlogConfig.requirementBacklog.id // Check if the NEXT level IS the requirement backlog
        ) {
          allowedChildTypes.push(...bugTypes);
        }
      }

      // Add bugs as children if they appear with tasks AND the current level IS the requirement level
      if (
        bugsAppearOnTasks &&
        currentLevel.id === backlogConfig.requirementBacklog.id // Check if current level IS the requirement backlog
      ) {
        // If bugs behave like tasks, they are children of the requirement level items
        allowedChildTypes.push(...bugTypes);
      }

      currentLevelTypes.forEach((parentType: string) => {
        const existingChildren = rules.get(parentType) || [];
        const combinedChildren = [...new Set([...existingChildren, ...allowedChildTypes])];
        rules.set(parentType, combinedChildren);
      });
    }
    metadataLogger.debug('Determined Hierarchy Rules from Backlog Configuration:', rules);
  } catch (error) {
    metadataLogger.error('Error fetching backlog configuration:', error);
  }

  return rules;
};
