export type WorkItemTypeName = string;

export interface WorkItemTypeConfiguration {
  hierarchyRules?: string[];
  color?: string;
}

export type WorkItemConfigurationsMap = Map<WorkItemTypeName, WorkItemTypeConfiguration>;
