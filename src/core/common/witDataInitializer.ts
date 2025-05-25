import SDK from 'azure-devops-extension-sdk';
import { WorkItemTypeConfiguration } from '../models/commonTypes';
import { logger } from './logger';

const initializerLogger = logger.createChild('Initializer');

export interface WitDataInitializerResult {
  success: boolean;
  error?: string;
  updatesCount?: number;
}

/**
 * Initializes work item type data for the GlobalStateProvider.
 * @param batchSetWorkItemConfigurations Function to update the global state.
 * @returns Promise with initialization result.
 */
export async function initializeWitData(
  batchSetWorkItemConfigurations: (
    updates: Array<{
      workItemTypeName: string;
      configuration: Partial<WorkItemTypeConfiguration>;
    }>,
  ) => void,
): Promise<WitDataInitializerResult> {
  try {
    initializerLogger.debug('WIT Data Initializer - Starting data load...');

    const { getWorkItemTypes, getWorkItemHierarchyRules } = await import(
      '../../services/workItemMetadataService'
    );

    const webContext = SDK.getPageContext().webContext;
    const projectName = webContext.project?.name;

    if (!projectName) {
      const error = 'Could not determine project name';
      initializerLogger.error('WIT Data Initializer -', error);
      return { success: false, error };
    }

    initializerLogger.debug('WIT Data Initializer - Loading data for project:', projectName);
    const [types, rulesMap] = await Promise.all([
      getWorkItemTypes(projectName),
      getWorkItemHierarchyRules(),
    ]);

    const updates: Array<{
      workItemTypeName: string;
      configuration: Partial<WorkItemTypeConfiguration>;
    }> = [];
    const allTypeNames = new Set<string>();

    // Collect all type names from types and hierarchy rules
    types.forEach((t) => allTypeNames.add(t.name));
    rulesMap.forEach((_children, parentName) => allTypeNames.add(parentName));
    rulesMap.forEach((children) => children.forEach((childName) => allTypeNames.add(childName)));

    // Build configuration updates for each type
    allTypeNames.forEach((typeName) => {
      const typeInfo = types.find((t) => t.name === typeName);
      const hierarchyRules = rulesMap.get(typeName);
      const config: Partial<WorkItemTypeConfiguration> = {};

      if (typeInfo) {
        if (typeInfo.color) {
          config.color = '#' + typeInfo.color;
        }
        if (typeInfo.icon && typeInfo.icon.url) {
          config.iconUrl = typeInfo.icon.url;
        }
      }

      if (hierarchyRules) {
        config.hierarchyRules = hierarchyRules;
      }

      if (Object.keys(config).length > 0) {
        updates.push({ workItemTypeName: typeName, configuration: config });
      }
    });
    initializerLogger.debug('WIT Data Initializer - Loaded work item types:', types.length);
    initializerLogger.debug('WIT Data Initializer - Loaded hierarchy rules:', rulesMap.size);
    initializerLogger.debug('WIT Data Initializer - Updates to apply:', updates.length);

    batchSetWorkItemConfigurations(updates);

    return { success: true, updatesCount: updates.length };
  } catch (err: any) {
    const error = err?.message || 'Failed to load work item metadata';
    initializerLogger.error('WIT Data Initializer - Failed to load work item metadata:', err);
    return { success: false, error };
  }
}
