export type WorkItemTypeName = string;

export interface WorkItemTypeConfiguration {
  hierarchyRules?: string[];
  color?: string;
  iconUrl?: string;
  // *Note*: put here any additional properties mapped from the API
}

export type WorkItemConfigurationsMap = Map<WorkItemTypeName, WorkItemTypeConfiguration>;
