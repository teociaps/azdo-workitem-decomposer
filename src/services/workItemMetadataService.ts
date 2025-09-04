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
import { getGlobalRuntimeInitialContext } from '../context/runtimeInitialContext';

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

    metadataLogger.debug('Initializing Work Item Hierarchy Rules...');

    // Read runtime initial context for team info
    const runtimeContext = getGlobalRuntimeInitialContext();

    // Ensure SDK is ready to acquire project information (project is required for backlog queries)
    await SDK.init();
    await SDK.ready();
    metadataLogger.debug('Current Web Context:', SDK.getWebContext());

    const webContext = SDK.getPageContext().webContext;
    const currentProject = webContext.project;
    const sdkTeam = webContext.team; // Note: getTeamContext() does not work here, it raises an error see: https://github.com/microsoft/azure-devops-extension-sdk/issues/116
    metadataLogger.debug('Current Project:', currentProject);
    metadataLogger.debug('SDK Team:', sdkTeam);

    if (!currentProject || !webContext) {
      metadataLogger.error('Could not retrieve current project information via SDK.', {
        currentProject,
        webContext,
      });
      return rules;
    }

    // Prefer team info passed from the initialContext, if present
    const resolvedTeam = runtimeContext?.team ? runtimeContext.team : sdkTeam;
    metadataLogger.debug('Resolved team to use for backlog configuration:', resolvedTeam);

    const teamContext: TeamContext = {
      project: currentProject.name,
      projectId: currentProject.id,
      team: resolvedTeam?.name ?? '',
      teamId: resolvedTeam?.id ?? '',
    };
    metadataLogger.debug('Fetching backlog configuration for team:', teamContext);

    const backlogConfig: BacklogConfiguration = await workClient.getBacklogConfigurations(
      teamContext as TeamContext,
    );

    metadataLogger.debug('Fetched backlog configuration:', backlogConfig);

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

    metadataLogger.debug(`Bug behavior configuration: ${backlogConfig.bugsBehavior}`);

    // Check how bugs are configured to behave in the backlog
    if (backlogConfig.bugsBehavior !== BugsBehavior.Off) {
      // Attempt to get bug types from the category first
      const fetchedBugTypes = await getTypesInCategory(currentProject.name, bugCategoryRefName);
      metadataLogger.debug(
        `Fetched bug types from category '${bugCategoryRefName}':`,
        fetchedBugTypes,
      );

      if (fetchedBugTypes.length > 0) {
        bugTypes = fetchedBugTypes;
      } else {
        // Fallback or alternative logic if category fetch fails or is empty
        // Sometimes the backlog config might list them directly under a specific level
        // This part might need adjustment based on specific process template details
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
          metadataLogger.debug(`Found bug types in requirement backlog:`, bugTypes);
        } else if (
          backlogConfig.bugsBehavior === BugsBehavior.AsTasks &&
          backlogConfig.taskBacklog.workItemTypes.some((wit) =>
            wit.name.toLowerCase().includes('bug'),
          ) // Heuristic
        ) {
          bugTypes = backlogConfig.taskBacklog.workItemTypes
            .filter((wit) => wit.name.toLowerCase().includes('bug'))
            .map((wit) => wit.name);
          metadataLogger.debug(`Found bug types in task backlog:`, bugTypes);
        }
      }
    }

    metadataLogger.debug(`Final bug types determined:`, bugTypes);

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

      // Handle bug hierarchy based on configured behavior
      if (backlogConfig.bugsBehavior === BugsBehavior.AsRequirements) {
        // Managed with requirements - they appear at the same level as requirements
        // This means they are children of the level above requirements (Features, Epics, etc.)
        if (
          i + 1 < allBacklogs.length &&
          allBacklogs[i + 1].id === backlogConfig.requirementBacklog.id
        ) {
          allowedChildTypes.push(...bugTypes);
        }
      } else if (backlogConfig.bugsBehavior === BugsBehavior.AsTasks) {
        // Managed with tasks - they are children of requirement-level items
        if (currentLevel.id === backlogConfig.requirementBacklog.id) {
          allowedChildTypes.push(...bugTypes);
        }
      }
      // When bugsBehavior === BugsBehavior.Off, bugs are not added to any hierarchy

      metadataLogger.debug(
        `Level ${i}: ${currentLevel.name} (${currentLevel.id}) -> allowedChildTypes:`,
        allowedChildTypes,
      );
      metadataLogger.debug(
        `BugsBehavior: ${backlogConfig.bugsBehavior}, RequirementBacklog ID: ${backlogConfig.requirementBacklog.id}`,
      );

      currentLevelTypes.forEach((parentType: string) => {
        const existingChildren = rules.get(parentType) || [];
        const combinedChildren = [...new Set([...existingChildren, ...allowedChildTypes])];
        rules.set(parentType, combinedChildren);
      });

      // If bugs are managed as requirements, they can also be parents of tasks.
      // This rule needs to be added separately for the bug types themselves.
      if (
        backlogConfig.bugsBehavior === BugsBehavior.AsRequirements &&
        currentLevel.id === backlogConfig.requirementBacklog.id
      ) {
        metadataLogger.debug(`Adding Bug types as parents of tasks: ${bugTypes}`);
        bugTypes.forEach((bugType) => {
          const existingChildren = rules.get(bugType) || [];
          const childrenForBugs = [...new Set([...existingChildren, ...taskTypes])];
          rules.set(bugType, childrenForBugs);
          metadataLogger.debug(`Bug type '${bugType}' can have children:`, childrenForBugs);
        });
      }
    }
    metadataLogger.debug('Determined Hierarchy Rules from Backlog Configuration:', rules);
    metadataLogger.debug('Current Bug Behavior Setting:', {
      bugsBehavior: backlogConfig.bugsBehavior,
      AsRequirements: BugsBehavior.AsRequirements,
      AsTasks: BugsBehavior.AsTasks,
      Off: BugsBehavior.Off,
    });
  } catch (error) {
    metadataLogger.error('Error fetching backlog configuration:', error);
  }

  return rules;
};
