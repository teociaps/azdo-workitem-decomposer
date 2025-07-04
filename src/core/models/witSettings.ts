import { ITagSettings } from './tagSettings';

export interface IWitSettings {
  tags: ITagSettings;
  // Future WIT-related settings can be added here
}

export const DEFAULT_WIT_SETTINGS: IWitSettings = {
  tags: {},
};
