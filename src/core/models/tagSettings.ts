/* eslint-disable no-unused-vars */
export enum TagInheritance {
  NONE = 'none',
  PARENT = 'parent',
  ANCESTORS = 'ancestors',
}
/* eslint-enable no-unused-vars */

export interface IWorkItemTagSettings {
  inheritance: TagInheritance;
  tags: string[];
}

export interface ITagSettings {
  [workItemTypeName: string]: IWorkItemTagSettings;
}
