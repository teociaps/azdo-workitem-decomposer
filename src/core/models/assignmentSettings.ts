/* eslint-disable no-unused-vars */
export enum AssignmentBehavior {
  NONE = 'none',
  DECOMPOSING_ITEM = 'decomposing_item',
  CREATOR = 'creator',
}
/* eslint-enable no-unused-vars */

export interface IWorkItemAssignmentSettings {
  behavior: AssignmentBehavior;
}

export interface IAssignmentSettings {
  [workItemTypeName: string]: IWorkItemAssignmentSettings;
}
