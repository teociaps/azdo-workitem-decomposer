import { ITagSettings } from './tagSettings';
import { IAssignmentSettings } from './assignmentSettings';

export interface IWitSettings {
  tags: ITagSettings;
  assignments: IAssignmentSettings;
}

export interface IAreaPathWitSettings {
  [areaPath: string]: IWitSettings; // Area path specific settings
}

export interface IAreaBasedWitSettings {
  default: IWitSettings; // Default settings for area paths without specific settings
  byAreaPath: IAreaPathWitSettings; // Area path specific settings
}

export const DEFAULT_WIT_SETTINGS: IWitSettings = {
  tags: {},
  assignments: {},
};

export const DEFAULT_AREA_BASED_WIT_SETTINGS: IAreaBasedWitSettings = {
  default: DEFAULT_WIT_SETTINGS,
  byAreaPath: {},
};
