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
