import SDK from 'azure-devops-extension-sdk';
import {
  CommonServiceIds,
  IExtensionDataService,
  IExtensionDataManager,
} from 'azure-devops-extension-api';
import { logger } from '../core/common/logger';
import { IWitSettings, DEFAULT_WIT_SETTINGS } from '../core/models/witSettings';

const settingsLogger = logger.createChild('Settings');

export interface DecomposerSettings {
  addCommentsToWorkItems: boolean;
  commentText: string;
  deleteConfirmation: {
    enabled: boolean;
    onlyForItemsWithChildren: boolean;
    showVisualCues: boolean;
  };
  userPermissions: {
    allowedUsers: string[]; // Array of user entity IDs who can edit settings
  };
}

export const DEFAULT_SETTINGS: DecomposerSettings = {
  addCommentsToWorkItems: true,
  commentText:
    '<i>Created automatically via <strong><a href="https://marketplace.visualstudio.com/items?itemName=teociaps.work-item-decomposer" target="_blank">Work Item Decomposer Extension</a></strong> as part of a hierarchy breakdown.</i>',
  deleteConfirmation: {
    enabled: true,
    onlyForItemsWithChildren: false,
    showVisualCues: true,
  },
  userPermissions: {
    allowedUsers: [], // Initially empty - only admins can edit
  },
};

export const SETTINGS_KEY = 'decomposer-settings-v1'; // Versioned to avoid conflicts with old settings if any
export const WIT_SETTINGS_KEY = 'decomposer-wit-settings-v1'; // Unified WIT settings key

class SettingsService {
  private dataManagerPromise: Promise<IExtensionDataManager> | undefined;

  private async getDataManager(): Promise<IExtensionDataManager> {
    if (!this.dataManagerPromise) {
      await SDK.init({ loaded: false });
      await SDK.ready();
      const accessToken = await SDK.getAccessToken();
      this.dataManagerPromise = SDK.getService<IExtensionDataService>(
        CommonServiceIds.ExtensionDataService,
      ).then((dataService) =>
        dataService.getExtensionDataManager(SDK.getExtensionContext().id, accessToken),
      );
    }
    return this.dataManagerPromise;
  }

  public async getSettings(): Promise<DecomposerSettings> {
    try {
      const dataManager = await this.getDataManager();
      const settings = await dataManager.getValue<DecomposerSettings>(SETTINGS_KEY, {
        scopeType: 'Default',
      }); // Merge with defaults to ensure all keys are present if settings were saved with an older version
      return { ...DEFAULT_SETTINGS, ...(settings || {}) };
    } catch (error) {
      settingsLogger.error('Failed to get settings, returning default settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  public async saveSettings(settings: DecomposerSettings): Promise<DecomposerSettings> {
    try {
      const dataManager = await this.getDataManager();
      await dataManager.setValue(SETTINGS_KEY, settings, { scopeType: 'Default' });
      return settings;
    } catch (error) {
      settingsLogger.error('Failed to save settings:', error);
      throw error;
    }
  }

  public async getWitSettings(): Promise<IWitSettings> {
    try {
      const dataManager = await this.getDataManager();
      const settings = await dataManager.getValue<IWitSettings>(WIT_SETTINGS_KEY, {
        scopeType: 'Default',
      });

      return { ...DEFAULT_WIT_SETTINGS, ...(settings || {}) };
    } catch (error) {
      settingsLogger.error('Failed to get WIT settings:', error);
      return DEFAULT_WIT_SETTINGS;
    }
  }

  public async saveWitSettings(settings: IWitSettings): Promise<IWitSettings> {
    try {
      const dataManager = await this.getDataManager();
      await dataManager.setValue(WIT_SETTINGS_KEY, settings, {
        scopeType: 'Default',
      });
      return settings;
    } catch (error) {
      settingsLogger.error('Failed to save WIT settings:', error);
      throw error;
    }
  }
}

const settingsService = new SettingsService();
export default settingsService;
