import { ITagSettings } from './tagSettings';
import { IAssignmentSettings } from './assignmentSettings';

export interface IWitSettings {
  tags: ITagSettings;
  assignments: IAssignmentSettings;
}

export const DEFAULT_WIT_SETTINGS: IWitSettings = {
  tags: {},
  assignments: {},
};
