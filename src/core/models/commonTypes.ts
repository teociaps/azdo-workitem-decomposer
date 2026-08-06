export type WorkItemTypeName = string;

export interface WorkItemTypeConfiguration {
  hierarchyRules?: string[];
  color?: string;
  iconUrl?: string;
  isDisabled?: boolean;
  // *Note*: put here any additional properties mapped from the API
}

export type WorkItemConfigurationsMap = Map<WorkItemTypeName, WorkItemTypeConfiguration>;

export const isWorkItemTypeEnabled = (config?: WorkItemTypeConfiguration): boolean =>
  !config?.isDisabled;

/**
 * Filters a list of work item type names down to those that are enabled (not disabled)
 * @param names The work item type names to filter
 * @param configurations The work item configurations to check enabled status against
 * @returns The subset of names that are enabled
 */
export function filterEnabledTypeNames(
  names: WorkItemTypeName[],
  configurations: WorkItemConfigurationsMap,
): WorkItemTypeName[] {
  return names.filter((name) => isWorkItemTypeEnabled(configurations.get(name)));
}
